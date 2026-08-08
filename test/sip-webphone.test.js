const assert = require('node:assert/strict');
const webphone = require('../FritzSipWebPhone.js');

assert.equal(webphone.API_VERSION, '1');
assert.equal(webphone.normalizeRegistrar('sip:sipgate.de:5060'), 'sipgate.de');
assert.equal(webphone.resolveProvider('sipgate.de').id, 'sipgate');
assert.equal(webphone.resolveProvider('sip.sipgate.de').id, 'sipgate');
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

console.log('SIP webphone provider tests passed.');
