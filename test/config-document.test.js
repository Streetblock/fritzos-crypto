const assert = require('node:assert/strict');
const Config = require('../FritzConfigDocument.js');
const Sip = require('../FritzSipAccounts.js');

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

const changed = Sip.update(document, accounts[0], { enabled: 'no', registrar: 'new.example.net' });
assert.match(changed, /ua4 \{[\s\S]*enabled = no;[\s\S]*registrar = "new\.example\.net";/);
assert.match(changed, /\/\* preserved comment \*\//, 'unrelated syntax must remain untouched');
assert.match(changed, /passwd = "\$\$\$\$PASSWORD";/, 'encrypted fields must remain untouched');

const cloned = Sip.clone(document, accounts[0]);
assert.equal(cloned.accountName, 'ua1');
const clonedDocument = Config.parse(cloned.updatedText);
assert.deepEqual(Sip.project(clonedDocument).map(account => account.name), ['ua4', 'ua1', 'ua5']);
assert.equal((cloned.updatedText.match(/\$\$\$\$PASSWORD/g) || []).length, 2, 'cloning must preserve encrypted values verbatim');

const secret = { start: source.indexOf('$$$$PASSWORD'), end: source.indexOf('$$$$PASSWORD') + 12 };
assert.equal(Sip.findBySecret(accounts, secret).name, 'ua4');

console.log('Lossless config document and SIP projection tests passed.');
