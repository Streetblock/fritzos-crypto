const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const webphone = require('../src/FritzSipWebPhone.js');
const providerTable = require('../src/SipWebPhoneProviders.json');

async function main() {
  assert.equal(webphone.API_VERSION, '1');
  const browserContext = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/SipWebPhoneProviders.js'), 'utf8'), browserContext);
  assert.deepEqual(JSON.parse(JSON.stringify(browserContext.FritzSipProviderTable)), providerTable, 'generated browser provider table must match its JSON source');
  assert.equal(providerTable.registrars['sipgate.de'], 'sipgate');
  assert.equal(providerTable.providers.sipgate.websocket, 'wss://sip.sipgate.de:443');
  assert.equal(webphone.normalizeRegistrar('sip:sipgate.de:5060'), 'sipgate.de');
  assert.equal(webphone.resolveProvider('sipgate.de').id, 'sipgate');
  assert.equal(webphone.resolveProvider('sip.sipgate.de').id, 'sipgate');
  assert.equal(webphone.resolveProvider('customer.sipgate.de'), null, 'registrars must be allowlisted exactly');
  assert.equal(webphone.resolveProvider('sipgate.io'), null, 'undocumented aliases must not be inferred');
  assert.equal(webphone.resolveProvider('tel.t-online.de'), null, 'unsupported providers must not receive guessed WSS endpoints');

  const account = webphone.createCompatibleAccount({
    id: 'ua1',
    username: '1234567e0',
    authorizationUsername: '1234567e0',
    password: 'secret',
    registrar: 'sipgate.de'
  });
  assert.equal(account.websocket, 'wss://sip.sipgate.de:443');
  assert.equal(account.password, 'secret');
  assert.equal(webphone.createCompatibleAccount({ username: 'x', password: 'y', registrar: 'tel.t-online.de' }), null);
  assert.equal(webphone.sanitizeDialTarget('+49 (211) 123-45'), '+4921112345');
  assert.throws(() => webphone.sanitizeDialTarget('alice@example.org'), /Ungültige Rufnummer/);

  class Emitter {
    constructor() { this.listeners = new Set(); }
    addListener(listener) { this.listeners.add(listener); }
    removeListener(listener) { this.listeners.delete(listener); }
    emit(value) { this.listeners.forEach(listener => listener(value)); }
  }
  class UserAgent {
    static makeURI(uri) { return uri.startsWith('sip:') ? uri : null; }
    constructor(configuration) { this.configuration = configuration; UserAgent.last = this; }
    async start() {}
    async stop() {}
  }
  class Registerer {
    constructor() { this.stateChange = new Emitter(); }
    async register() { queueMicrotask(() => this.stateChange.emit('Registered')); }
    async unregister() {}
  }
  class Inviter {
    constructor(_agent, uri) { this.uri = uri; this.state = 'Initial'; this.stateChange = new Emitter(); Inviter.last = this; }
    async invite() { this.state = 'Establishing'; this.stateChange.emit(this.state); }
    async cancel() { this.state = 'Terminated'; this.stateChange.emit(this.state); }
  }
  const states = [];
  const phone = new webphone.SipWebPhone({
    SIP: {
      UserAgent,
      Registerer,
      Inviter,
      RegistererState: { Registered: 'Registered', Terminated: 'Terminated' },
      SessionState: { Initial: 'Initial', Establishing: 'Establishing', Established: 'Established', Terminated: 'Terminated' }
    },
    onState: event => states.push(event.state)
  });
  await phone.connect(account);
  assert.equal(UserAgent.last.configuration.transportOptions.server, 'wss://sip.sipgate.de:443');
  assert.equal(UserAgent.last.configuration.authorizationPassword, 'secret');
  assert.equal(states.at(-1), 'registered', 'connection must wait for confirmed registration');
  await phone.call('+49 211 12345');
  assert.equal(Inviter.last.uri, 'sip:+4921112345@sipgate.de');
  assert.equal(states.at(-1), 'calling');
  await phone.hangup();

  console.log('SIP webphone provider tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
