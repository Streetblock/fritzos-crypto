const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

if (typeof globalThis.crypto === 'undefined') globalThis.crypto = nodeCrypto.webcrypto;
globalThis.pako = require('pako');
globalThis.CryptoJS = require('crypto-js');

const FritzOSCrypto = require('../FritzOSCrypto.js');
const FritzExportChecksum = require('../FritzExportChecksum.js');
const { API_VERSION, FritzExportEditor } = require('../FritzExportEditor.js');

async function run() {
  assert.equal(API_VERSION, '1');
  const password = 'export-password';
  const originalSecret = await FritzOSCrypto.AVMCrypto.encryptSecret('old value', password);
  const unchecked = [
    '**** FRITZ!Box 7590 CONFIGURATION EXPORT',
    'FirmwareVersion=154.08.00',
    '**** CFGFILE: wlan.cfg',
    `pskvalue = "${originalSecret}";`,
    `guest_pskvalue = "${originalSecret}";`,
    '**** END OF FILE ****',
    '**** END OF EXPORT 00000000 ****',
    ''
  ].join('\r\n');
  const source = FritzExportChecksum.fromText(unchecked).replaceChecksum().updatedText;
  const inventory = FritzOSCrypto.FritzBoxParser.extractSecretInventory(source);
  const mainSecret = inventory.find(secret => secret.field === 'pskvalue');
  const events = [];

  const result = await FritzExportEditor.applySecretChanges({
    text: source,
    password,
    changes: [Object.assign({}, mainSecret, {
      type: 4,
      plaintext: 'old value',
      editedPlaintext: 'new value'
    })],
    onStep: event => events.push(`${event.step}:${event.status}`)
  });

  assert.deepEqual(events, [
    'roundtrip:running',
    'roundtrip:success',
    'checksum:running',
    'checksum:success'
  ]);
  assert.equal(result.roundtrip.valid, true);
  assert.equal(result.checksum.valid, true);
  assert.equal(result.replacements.length, 1);
  assert.equal(result.updatedText.includes(originalSecret), true, 'unchanged duplicate occurrence must remain intact');
  assert.notEqual(result.replacements[0].newValue, originalSecret);
  assert.equal(
    (result.updatedText.match(new RegExp(originalSecret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
    1,
    'only the selected occurrence may be replaced'
  );
  const decrypted = await FritzOSCrypto.AVMCrypto.decryptSecret(result.replacements[0].newValue, password);
  assert.equal(decrypted.plaintext, 'new value');
  const crc = FritzExportChecksum.fromText(result.updatedText).calculate();
  assert.equal(crc.oldCrc, crc.newCrc);

  console.log('Atomic export editor tests passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
