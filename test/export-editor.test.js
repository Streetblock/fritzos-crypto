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
  assert.deepEqual(FritzExportEditor.verifyExportChecksum(result.updatedText), {
    valid: true,
    oldCrc: crc.oldCrc,
    newCrc: crc.newCrc
  });

  const masterKey = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
  const type5Secret = await FritzOSCrypto.encryptSecretWithKey('type5 old', masterKey);
  const type5Unchecked = unchecked.replace(originalSecret, () => type5Secret);
  const type5Source = FritzExportChecksum.fromText(type5Unchecked).replaceChecksum().updatedText;
  const type5Start = type5Source.indexOf(type5Secret);
  const type5Result = await FritzExportEditor.applySecretChanges({
    text: type5Source,
    password,
    masterKeyBytes: masterKey,
    changes: [Object.assign({}, mainSecret, {
      value: type5Secret,
      start: type5Start,
      end: type5Start + type5Secret.length,
      type: 5,
      plaintext: 'type5 old',
      editedPlaintext: 'type5 new'
    })]
  });
  assert.equal(
    FritzOSCrypto.decryptSecretWithKey(type5Result.replacements[0].newValue, masterKey).text,
    'type5 new'
  );

  await assert.rejects(
    FritzExportEditor.applySecretChanges({
      text: source,
      password,
      changes: [Object.assign({}, mainSecret, {
        start: mainSecret.start + 1,
        end: mainSecret.end + 1,
        type: 4,
        plaintext: 'old value',
        editedPlaintext: 'must fail'
      })]
    }),
    error => error.code === 'SECRET_POSITION_MISMATCH' && error.stage === 'roundtrip'
  );

  await assert.rejects(
    FritzExportEditor.applySecretChanges({
      text: source,
      password: 'wrong-password',
      changes: [Object.assign({}, mainSecret, {
        type: 4,
        plaintext: 'old value',
        editedPlaintext: 'must not be written'
      })]
    }),
    error => error.stage === 'roundtrip'
  );

  console.log('Atomic export editor tests passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
