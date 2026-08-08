(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./SipWebPhoneProviders.json"));
  else root.FritzSipWebPhone = factory(root.FritzSipProviderTable);
})(typeof globalThis !== "undefined" ? globalThis : this, function (providerTable) {
  "use strict";

  var API_VERSION = "1";
  var PROVIDER_TABLE = providerTable && providerTable.schemaVersion === "1"
    ? providerTable
    : { schemaVersion: "1", providers: {}, registrars: {} };
  var PROVIDERS = Object.freeze(Object.keys(PROVIDER_TABLE.providers).map(function (id) {
    return Object.freeze(Object.assign({ id: id }, PROVIDER_TABLE.providers[id]));
  }));

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
    var providerId = PROVIDER_TABLE.registrars[normalized];
    return PROVIDERS.find(function (provider) { return provider.id === providerId; }) || null;
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
      var registerer = this.registerer;
      var registererState = this.SIP.RegistererState;
      await new Promise(function (resolve, reject) {
        var settled = false;
        var timeout = setTimeout(function () { finish(new Error("Zeitüberschreitung bei der SIP-Registrierung")); }, 15000);
        function finish(error) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (registerer.stateChange && typeof registerer.stateChange.removeListener === "function") registerer.stateChange.removeListener(onChange);
          if (error) reject(error); else resolve();
        }
        function onChange(state) {
          if (registererState && state === registererState.Registered) finish();
          if (registererState && state === registererState.Terminated) finish(new Error("SIP-Registrierung wurde beendet"));
        }
        if (registerer.stateChange && typeof registerer.stateChange.addListener === "function") registerer.stateChange.addListener(onChange);
        registerer.register({
          requestDelegate: {
            onReject: function (response) {
              var status = response && response.message && response.message.statusCode;
              finish(new Error(status ? "SIP-Registrierung abgelehnt (" + status + ")" : "SIP-Registrierung abgelehnt"));
            }
          }
        }).then(function () {
          if (!registererState || !registerer.stateChange) finish();
        }).catch(finish);
      });
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
    try {
      await inviter.invite();
    } catch (error) {
      this.session = null;
      this.emitState("registered");
      throw error;
    }
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
    PROVIDER_TABLE: PROVIDER_TABLE,
    PROVIDERS: PROVIDERS,
    normalizeRegistrar: normalizeRegistrar,
    resolveProvider: resolveProvider,
    createCompatibleAccount: createCompatibleAccount,
    sanitizeDialTarget: sanitizeDialTarget,
    SipWebPhone: SipWebPhone
  };
});
