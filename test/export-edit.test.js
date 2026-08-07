const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = nodeCrypto.webcrypto;
}

const FritzOSCrypto = require('../FritzOSCrypto.js');
const FritzExportChecksum = require('../FritzExportChecksum.js');

async function run() {
  const masterKey = Uint8Array.from({ length: 16 }, (_, index) => 0x30 + index);
  const originalSecret = await FritzOSCrypto.encryptSecretWithKey('original-value', masterKey);
  const changedSecret = await FritzOSCrypto.encryptSecretWithKey('changed-value', masterKey);

  const uncheckedExport = [
    '**** FRITZ!Box 7590 CONFIGURATION EXPORT',
    'FirmwareVersion=154.08.00',
    '**** CFGFILE: wlan.cfg',
    'wlan {',
    `pskvalue = "${originalSecret}";`,
    '}',
    '**** END OF FILE ****',
    '**** END OF EXPORT 00000000 ****',
    ''
  ].join('\r\n');

  const validOriginal = FritzExportChecksum.fromText(uncheckedExport).replaceChecksum().updatedText;
  const originalCheck = FritzExportChecksum.fromText(validOriginal).calculate();
  assert.equal(originalCheck.oldCrc, originalCheck.newCrc, 'fixture must begin with a valid checksum');

  const staleEditedExport = validOriginal.replace(originalSecret, changedSecret);
  const staleCheck = FritzExportChecksum.fromText(staleEditedExport).calculate();
  assert.notEqual(staleCheck.oldCrc, staleCheck.newCrc, 'editing a secret must invalidate the previous checksum');

  const fixedExport = FritzExportChecksum.fromText(staleEditedExport).replaceChecksum().updatedText;
  const fixedCheck = FritzExportChecksum.fromText(fixedExport).calculate();
  assert.equal(fixedCheck.oldCrc, fixedCheck.newCrc, 'updated export checksum must verify');

  const decrypted = FritzOSCrypto.decryptSecretWithKey(changedSecret, masterKey);
  assert.equal(decrypted.text, 'changed-value', 're-encrypted secret must retain the requested plaintext');

  console.log('Export edit and checksum integration test passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
