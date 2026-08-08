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

const splitWlanSource = [
  '**** CFGFILE: wlan_common.cfg',
  'ssid = "FRITZ!Box Hauptnetz";',
  'guest_ssid = "FRITZ!Box Gäste";',
  '**** END OF FILE ****',
  '**** CFGFILE: wlan.cfg',
  'pskvalue = "$$$$MAINPASSWORD";',
  'guest_pskvalue = "$$$$GUESTPASSWORD";',
  '**** END OF FILE ****'
].join('\n');
const splitInventory = FritzBoxParser.extractSecretInventory(splitWlanSource);
assert.equal(splitInventory.find(item => item.field === 'pskvalue').network.ssid, 'FRITZ!Box Hauptnetz', 'SSID must carry across WLAN sections');
assert.equal(splitInventory.find(item => item.field === 'guest_pskvalue').network.ssid, 'FRITZ!Box Gäste', 'guest SSID must carry across WLAN sections');

const encryptedSsidSource = [
  '**** CFGFILE: wlan.cfg',
  'ssid = "$$$$ENCRYPTEDSSID";',
  'pskvalue = "$$$$ENCRYPTEDPASSWORD";',
  '**** END OF FILE ****'
].join('\n');
const encryptedSsidInventory = FritzBoxParser.extractSecretInventory(encryptedSsidSource);
const ssidSecret = encryptedSsidInventory.find(item => item.field === 'ssid');
const passwordSecret = encryptedSsidInventory.find(item => item.field === 'pskvalue');
assert.equal(ssidSecret.displayLabel, 'Haupt-WLAN-Name');
assert.equal(passwordSecret.displayLabel, 'WLAN-Schlüssel');
assert.equal(passwordSecret.network.ssidSecretId, ssidSecret.id, 'encrypted SSID must be linked to the WLAN credential');

const accountSource = [
  '**** CFGFILE: ar7.cfg',
  'boxusers {',
  'users {',
  'id = 1;',
  'name = "$$$$BOXUSER1";',
  'password = "$$$$BOXPASS1";',
  'box_admin_rights = 1;',
  '} {',
  'id = 2;',
  'name = "$$$$BOXUSER2";',
  'password = "$$$$BOXPASS2";',
  'box_admin_rights = 0;',
  '}',
  '}',
  'emailnotify {',
  'From = "$$$$SMTPFROM";',
  'To = "$$$$SMTPTO";',
  'SMTPServer = "smtp.example.invalid";',
  'accountname = "$$$$SMTPUSER";',
  'passwd = "$$$$SMTPPASS";',
  '}',
  'jasonii {',
  'user_email = "$$$$MYFRITZEMAIL";',
  'dyn_dns_name = "$$$$MYFRITZDOMAIN";',
  'oauth_client_id = "$$$$OAUTHID";',
  'oauth_client_secret = "$$$$OAUTHSECRET";',
  '}',
  'unrelated {',
  'name = "$$$$NOTPROVIDER";',
  '}',
  'ddns {',
  'accounts {',
  'domain = "$$$$USERDDNSDOMAIN";',
  'username = "$$$$USERDDNSUSER";',
  'passwd = "$$$$USERDDNSPASS";',
  '}',
  '}',
  '**** END OF FILE ****',
  '**** CFGFILE: tr069.cfg',
  'lab {',
  'CRUsername = "$$$$CRUSER";',
  'CRPassword = "$$$$CRPASS";',
  'DDNS {',
  'username = "$$$$DDNSUSER";',
  'password = "$$$$DDNSPASS";',
  'domain_name = "$$$$DDNSDOMAIN";',
  '}',
  '}',
  '**** END OF FILE ****'
].join('\n');

const accountInventory = FritzBoxParser.extractSecretInventory(accountSource);
const byFieldAndValue = (field, value) => accountInventory.find(item => item.field === field && item.value === value);
assert.equal(byFieldAndValue('name', '$$$$BOXUSER1').category, 'fritz-user');
assert.equal(byFieldAndValue('password', '$$$$BOXPASS1').displayLabel, 'FRITZ!Box-Kennwort');
assert.notEqual(
  byFieldAndValue('name', '$$$$BOXUSER1').credentialGroup.id,
  byFieldAndValue('name', '$$$$BOXUSER2').credentialGroup.id,
  'repeated FRITZ!Box user blocks must remain separate accounts'
);
assert.equal(byFieldAndValue('accountname', '$$$$SMTPUSER').category, 'email');
assert.equal(byFieldAndValue('passwd', '$$$$SMTPPASS').displayLabel, 'SMTP-Passwort');
assert.equal(byFieldAndValue('user_email', '$$$$MYFRITZEMAIL').category, 'myfritz');
assert.equal(byFieldAndValue('dyn_dns_name', '$$$$MYFRITZDOMAIN').displayLabel, 'MyFRITZ!-Adresse');
assert.equal(byFieldAndValue('CRUsername', '$$$$CRUSER').category, 'remote-management');
assert.equal(byFieldAndValue('CRPassword', '$$$$CRPASS').displayLabel, 'Provider-Fernwartung: Passwort');
assert.equal(byFieldAndValue('username', '$$$$DDNSUSER').category, 'remote-management');
assert.equal(byFieldAndValue('domain_name', '$$$$DDNSDOMAIN').displayLabel, 'Provider-Fernwartungsadresse');
assert.equal(byFieldAndValue('domain', '$$$$USERDDNSDOMAIN').category, 'dyndns');
assert.equal(byFieldAndValue('username', '$$$$USERDDNSUSER').displayLabel, 'DynDNS-Benutzername');
assert.equal(byFieldAndValue('name', '$$$$NOTPROVIDER').category, 'other', 'unknown ar7 fields must not default to provider');

const phonebookSource = [
  '**** CFGFILE: voip.cfg',
  'ua1 {',
  'username = "$$$$REALSIPUSER";',
  'passwd = "$$$$REALSIPPASS";',
  '}',
  'online_phonebook {',
  'username = "$$$$PHONEBOOKUSER";',
  'passwd = "$$$$PHONEBOOKPASS";',
  '}',
  'extensions {',
  'username = "$$$$INTERNALUSER";',
  'passwd = "$$$$INTERNALPASS";',
  'clientid = "$$$$INTERNALCLIENT";',
  'extension_number = 620;',
  'appid = 20;',
  '}',
  'service {',
  'username = "$$$$NONSIPTELEPHONY";',
  '}',
  '**** END OF FILE ****'
].join('\n');
const phonebookInventory = FritzBoxParser.extractSecretInventory(phonebookSource);
const phonebookByValue = value => phonebookInventory.find(item => item.value === value);
assert.equal(phonebookByValue('$$$$REALSIPUSER').category, 'sip');
assert.equal(phonebookByValue('$$$$PHONEBOOKUSER').category, 'online-phonebook');
assert.equal(phonebookByValue('$$$$PHONEBOOKPASS').displayLabel, 'Online-Telefonbuch: Kennwort');
assert.equal(phonebookByValue('$$$$INTERNALUSER').category, 'internal-telephony');
assert.equal(phonebookByValue('$$$$INTERNALPASS').displayLabel, 'Interne Nebenstelle: Kennwort');
assert.equal(phonebookByValue('$$$$INTERNALCLIENT').displayLabel, 'FRITZ!App-Fon-Geräte-ID');
assert.equal(phonebookByValue('$$$$INTERNALUSER').account, null, 'internal extensions must not be grouped as provider SIP accounts');
assert.equal(phonebookByValue('$$$$INTERNALUSER').credentialGroup.id, phonebookByValue('$$$$INTERNALPASS').credentialGroup.id);
assert.equal(phonebookByValue('$$$$INTERNALUSER').credentialGroup.metadata.extension_number, '620');
assert.equal(phonebookByValue('$$$$NONSIPTELEPHONY').category, 'telephony', 'voip.cfg alone must not imply a SIP account');

console.log('Structured secret inventory tests passed.');
