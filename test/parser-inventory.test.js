const assert = require('node:assert/strict');
const { FritzBoxParser } = require('../FritzOSCrypto.js');

const duplicate = '$$$$DUPLICATE1234';
const sipPasswordOne = '$$$$SIPPASSWORD1';
const sipUsernameTwo = '$$$$SIPUSERNAME2';
const sipPasswordTwo = '$$$$SIPPASSWORD2';
const vpnSecret = '$$$$VPNSECRET1';
const providerSecret = '$$$$PROVIDER1';
const masterSecret = '$$$$MASTERKEY1';

const source = [
  '**** FRITZ!Box 7590 CONFIGURATION EXPORT',
  `Password=${masterSecret}`,
  '**** CFGFILE: wlan.cfg',
  'ssid = "Home\\"Lab;5G";',
  `pskvalue = "${duplicate}";`,
  'guest_ssid = "Gäste, WLAN: Süd";',
  `guest_pskvalue = "${duplicate}";`,
  '**** END OF FILE ****',
  '**** CFGFILE: voip.cfg',
  'ua {',
  'username = "030123456";',
  'registrar = "sip.example.net";',
  `passwd = "${sipPasswordOne}";`,
  '}',
  'ua {',
  `username = "${sipUsernameTwo}";`,
  'registrar = "sip.second.example";',
  `passwd = "${sipPasswordTwo}";`,
  '}',
  '**** END OF FILE ****',
  '**** CFGFILE: vpn.cfg',
  `secret = "${vpnSecret}";`,
  '**** END OF FILE ****',
  '**** CFGFILE: ar7.cfg',
  `provider_password = "${providerSecret}";`,
  '**** END OF FILE ****'
].join('\r\n');

const inventory = FritzBoxParser.extractSecretInventory(source);
assert.equal(inventory.length, 8, 'every occurrence must be represented');

for (const item of inventory) {
  assert.equal(source.slice(item.start, item.end), item.value, `invalid range for ${item.id}`);
  assert.equal(item.line, source.slice(0, item.start).split(/\r\n|\n/).length, `invalid line for ${item.id}`);
}

const duplicateOccurrences = inventory.filter(item => item.value === duplicate);
assert.equal(duplicateOccurrences.length, 2, 'duplicate ciphertext must remain two editable occurrences');
assert.notEqual(duplicateOccurrences[0].id, duplicateOccurrences[1].id);
assert.notEqual(duplicateOccurrences[0].stableKey, duplicateOccurrences[1].stableKey);
assert.deepEqual(duplicateOccurrences.map(item => item.category), ['wlan', 'guest-wlan']);
assert.deepEqual(duplicateOccurrences.map(item => item.displayLabel), ['WLAN-Schlüssel', 'Gast-WLAN-Schlüssel']);
assert.equal(duplicateOccurrences[0].network.ssid, 'Home"Lab;5G');
assert.equal(duplicateOccurrences[1].network.ssid, 'Gäste, WLAN: Süd');

const qrPayload = FritzBoxParser.buildWifiQrPayload(
  { ssid: 'Home"Lab;5G', authentication: 'WPA', hidden: false },
  'p\\ass;word,with:marks"'
);
assert.equal(qrPayload, 'WIFI:T:WPA;S:Home\\"Lab\\;5G;P:p\\\\ass\\;word\\,with\\:marks\\";H:false;;');

const firstSip = inventory.find(item => item.value === sipPasswordOne);
const secondSipPassword = inventory.find(item => item.value === sipPasswordTwo);
const secondSipUsername = inventory.find(item => item.value === sipUsernameTwo);
assert.equal(firstSip.account.username, '030123456');
assert.equal(firstSip.account.registrar, 'sip.example.net');
assert.equal(secondSipPassword.account.registrar, 'sip.second.example');
assert.equal(secondSipUsername.account.usernameSecretId, secondSipUsername.id);
assert.equal(secondSipPassword.account.id, secondSipUsername.account.id, 'SIP fields must share one account');
assert.notEqual(firstSip.account.id, secondSipPassword.account.id, 'separate SIP accounts must not be merged');

assert.equal(inventory.find(item => item.value === masterSecret).category, 'system');
assert.equal(inventory.find(item => item.value === vpnSecret).category, 'vpn');
assert.equal(inventory.find(item => item.value === providerSecret).category, 'provider');
assert.equal(FritzBoxParser.extractSecrets(source).filter(value => value === duplicate).length, 1, 'legacy API remains unique');

console.log('Structured secret inventory tests passed.');
