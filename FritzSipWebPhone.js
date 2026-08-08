(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzSipWebPhone = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var API_VERSION = "1";
  var PROVIDERS = Object.freeze([
    Object.freeze({
      id: "sipgate",
      name: "Sipgate",
      registrarPattern: /(^|\.)sipgate\.(?:de|io)$/i,
      websocket: "wss://sip.sipgate.de:443",
      credentialsMode: "sip-account"
    })
  ]);

  function normalizeRegistrar(value) {
    return String(value || "")
      .trim()
      .replace(/^sips?:\/\//i, "")
      .replace(/^sips?:/i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .toLowerCase();
  }

  function resolveProvider(registrar) {
    var normalized = normalizeRegistrar(registrar);
    return PROVIDERS.find(function (provider) { return provider.registrarPattern.test(normalized); }) || null;
  }

  function createCompatibleAccount(input) {
    var source = input || {};
    var registrar = normalizeRegistrar(source.registrar);
    var provider = resolveProvider(registrar);
    var username = String(source.username || "").trim();
    var authorizationUsername = String(source.authorizationUsername || username).trim();
    var password = String(source.password || "");
    if (!provider || !registrar || !username || !authorizationUsername || !password) return null;
    return {
      id: String(source.id || username + "@" + registrar),
      name: String(source.name || username),
      providerId: provider.id,
      providerName: provider.name,
      username: username,
      authorizationUsername: authorizationUsername,
      password: password,
      registrar: registrar,
      websocket: provider.websocket
    };
  }

  function sanitizeDialTarget(value) {
    var normalized = String(value || "").trim().replace(/[\s().-]+/g, "");
    if (!normalized || !/^\+?[0-9*#]+$/.test(normalized)) throw new Error("Ungültige Rufnummer");
    return normalized;
  }

  function SipWebPhone(options) {
    var settings = options || {};
    this.SIP = settings.SIP || (typeof globalThis !== "undefined" ? globalThis.SIP : null);
    this.remoteAudio = settings.remoteAudio || null;
    this.onState = typeof settings.onState === "function" ? settings.onState : function () {};
    this.onIncoming = typeof settings.onIncoming === "function" ? settings.onIncoming : function () {};
    this.userAgent = null;
    this.registerer = null;
    this.session = null;
    this.account = null;
  }

  SipWebPhone.prototype.emitState = function (state, detail) {
    this.onState({ state: state, detail: detail || "", account: this.account });
  };

  SipWebPhone.prototype.attachSession = function (session) {
    var self = this;
    this.session = session;
    session.stateChange.addListener(function (state) {
      var states = self.SIP.SessionState;
      if (state === states.Establishing) self.emitState("calling");
      if (state === states.Established) {
        self.attachRemoteAudio(session);
        self.emitState("active");
      }
      if (state === states.Terminated) {
        self.session = null;
        self.emitState("registered");
      }
    });
  };

  SipWebPhone.prototype.attachRemoteAudio = function (session) {
    var peerConnection = session && session.sessionDescriptionHandler && session.sessionDescriptionHandler.peerConnection;
    if (!peerConnection || !this.remoteAudio || typeof MediaStream === "undefined") return;
    var stream = new MediaStream();
    peerConnection.getReceivers().forEach(function (receiver) { if (receiver.track) stream.addTrack(receiver.track); });
    this.remoteAudio.srcObject = stream;
    if (typeof this.remoteAudio.play === "function") this.remoteAudio.play().catch(function () {});
  };

  SipWebPhone.prototype.connect = async function (account) {
    if (!this.SIP || !this.SIP.UserAgent || !this.SIP.Registerer) throw new Error("SIP.js ist nicht verfügbar");
    await this.disconnect();
    this.account = account;
    var uri = this.SIP.UserAgent.makeURI("sip:" + account.username + "@" + account.registrar);
    if (!uri) throw new Error("Ungültige SIP-Adresse");
    var self = this;
    this.emitState("connecting");
    this.userAgent = new this.SIP.UserAgent({
      uri: uri,
      authorizationUsername: account.authorizationUsername,
      authorizationPassword: account.password,
      transportOptions: { server: account.websocket },
      sessionDescriptionHandlerFactoryOptions: { constraints: { audio: true, video: false } },
      delegate: {
        onInvite: function (invitation) {
          if (self.session) {
            invitation.reject();
            return;
          }
          self.attachSession(invitation);
          self.onIncoming(invitation, invitation.remoteIdentity && invitation.remoteIdentity.uri && invitation.remoteIdentity.uri.user || "Unbekannt");
        }
      }
    });
    try {
      await this.userAgent.start();
      this.registerer = new this.SIP.Registerer(this.userAgent);
      await this.registerer.register();
      this.emitState("registered");
    } catch (error) {
      await this.disconnect();
      this.emitState("failed", error && error.message || String(error));
      throw error;
    }
  };

  SipWebPhone.prototype.call = async function (target) {
    if (!this.userAgent || !this.account) throw new Error("SIP-Konto ist nicht verbunden");
    if (this.session) throw new Error("Es läuft bereits ein Gespräch");
    var number = sanitizeDialTarget(target);
    var uri = this.SIP.UserAgent.makeURI("sip:" + number + "@" + this.account.registrar);
    if (!uri) throw new Error("Ungültiges Anrufziel");
    var inviter = new this.SIP.Inviter(this.userAgent, uri, {
      sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } }
    });
    this.attachSession(inviter);
    await inviter.invite();
  };

  SipWebPhone.prototype.answer = async function () {
    if (!this.session || typeof this.session.accept !== "function") throw new Error("Kein eingehender Anruf");
    await this.session.accept({ sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } } });
  };

  SipWebPhone.prototype.hangup = async function () {
    if (!this.session) return;
    var session = this.session;
    var state = session.state;
    if (state === this.SIP.SessionState.Initial && typeof session.reject === "function") await session.reject();
    else if (state === this.SIP.SessionState.Establishing && typeof session.cancel === "function") await session.cancel();
    else if (typeof session.bye === "function") await session.bye();
    this.session = null;
    this.emitState(this.account ? "registered" : "idle");
  };

  SipWebPhone.prototype.disconnect = async function () {
    try { await this.hangup(); } catch (_) {}
    try { if (this.registerer) await this.registerer.unregister(); } catch (_) {}
    try { if (this.userAgent) await this.userAgent.stop(); } catch (_) {}
    this.registerer = null;
    this.userAgent = null;
    this.session = null;
    this.account = null;
    this.emitState("idle");
  };

  return {
    API_VERSION: API_VERSION,
    PROVIDERS: PROVIDERS,
    normalizeRegistrar: normalizeRegistrar,
    resolveProvider: resolveProvider,
    createCompatibleAccount: createCompatibleAccount,
    sanitizeDialTarget: sanitizeDialTarget,
    SipWebPhone: SipWebPhone
  };
});
