const assert = require('node:assert/strict');
const Config = require('../src/FritzConfigDocument.js');
const Sip = require('../src/FritzSipAccounts.js');
const { FritzBoxParser } = require('../lib/FritzOSCrypto.js');
const { ConfigState } = require('../src/ConfigState.js');

const source = [
  '**** FRITZ!Box Test CONFIGURATION EXPORT',
  '**** CFGFILE:voip.cfg',
  '/* preserved comment */',
  'voipcfg {',
  '  ua4 {',
  '    enabled = yes;',
  '    username = "$$$$USER";',
  '    passwd = "$$$$PASSWORD";',
  '    registrar = "sip.example.net";',
  '    transport_type = 0;',
  '  }',
  '  ua5 { enabled = no; username = "plain"; passwd = "$$$$OTHER"; registrar = "second.example"; }',
  '  connections { name = "first"; wg_allowed_ips = "10.0.0.0/24", } { name = "second"; wg_allowed_ips = "10.1.0.0/24", }',
  '  extensions { username = "phone"; passwd = "$$$$INTERNAL"; }',
  '}',
  '**** END OF FILE ****',
  '**** END OF EXPORT 00000000 ****',
  ''
].join('\r\n');

const document = Config.parse(source);
assert.equal(document.source, source, 'unchanged serialization source must remain byte-identical');
assert.equal(document.applyPatches([]), source, 'an unchanged document must roundtrip byte-identically');
assert.equal(document.getSection('voip.cfg').line, 2);

const accounts = Sip.project(document);
assert.deepEqual(accounts.map(account => account.name), ['ua4', 'ua5']);
assert.equal(accounts[0].line, 5);
assert.equal(accounts[0].values.registrar, 'sip.example.net');
assert.equal(accounts[1].values.enabled, 'no');
assert.equal(accounts.some(account => account.name === 'extensions'), false);
const connectionBlocks = document.getBlocks(document.getSection('voip.cfg'), block => block.name === 'connections');
assert.equal(connectionBlocks.length, 2, 'anonymous sibling blocks must become separate instances');
assert.deepEqual(connectionBlocks.map(block => document.getAssignments(block).find(item => item.name === 'name').value), ['first', 'second']);
assert.deepEqual(connectionBlocks.map(block => document.getAssignments(block).find(item => item.name === 'wg_allowed_ips').value), ['10.0.0.0/24', '10.1.0.0/24']);

const changed = Sip.update(document, accounts[0], { enabled: 'no', registrar: 'new.example.net' });
assert.match(changed, /ua4 \{[\s\S]*enabled = no;[\s\S]*registrar = "new\.example\.net";/);
assert.match(changed, /\/\* preserved comment \*\//, 'unrelated syntax must remain untouched');
assert.match(changed, /passwd = "\$\$\$\$PASSWORD";/, 'encrypted fields must remain untouched');

const cloned = Sip.clone(document, accounts[0], { enabled: 'no', registrar: 'draft.example.net' });
assert.equal(cloned.accountName, 'ua1');
const clonedDocument = Config.parse(cloned.updatedText);
assert.deepEqual(Sip.project(clonedDocument).map(account => account.name), ['ua4', 'ua1', 'ua5']);
assert.equal(Sip.project(clonedDocument)[1].values.enabled, 'no');
assert.equal(Sip.project(clonedDocument)[1].values.registrar, 'draft.example.net');
assert.equal((cloned.updatedText.match(/\$\$\$\$PASSWORD/g) || []).length, 2, 'cloning must preserve encrypted values verbatim');

const secret = { start: source.indexOf('$$$$PASSWORD'), end: source.indexOf('$$$$PASSWORD') + 12 };
assert.equal(Sip.findBySecret(accounts, secret).name, 'ua4');

const state = new ConfigState(FritzBoxParser);
state.load(source);
const ua4Password = state.secrets.find(item => item.value === '$$$$PASSWORD');
const ua5Password = state.secrets.find(item => item.value === '$$$$OTHER');
state.markDecrypted(ua4Password.id, { plaintext: 'first', type: 4 });
state.markDecrypted(ua5Password.id, { plaintext: 'second', type: 4 });
state.setWorkingText(cloned.updatedText);
const preservedUa4 = state.secrets.find(item => item.stableKey.includes('|ua4|passwd|'));
const preservedUa5 = state.secrets.find(item => item.stableKey.includes('|ua5|passwd|'));
const newUa1 = state.secrets.find(item => item.stableKey.includes('|ua1|passwd|'));
assert.equal(preservedUa4.plaintext, 'first', 'cloning must retain the source account decryption state');
assert.equal(preservedUa5.plaintext, 'second', 'cloning must not shift a following account onto the wrong plaintext');
assert.equal(newUa1.status, 'pending', 'the new ciphertext occurrence must be decrypted independently');

console.log('Lossless config document and SIP projection tests passed.');
