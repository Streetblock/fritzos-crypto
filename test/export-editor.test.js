const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

if (typeof globalThis.crypto === 'undefined') globalThis.crypto = nodeCrypto.webcrypto;
globalThis.pako = require('pako');
globalThis.CryptoJS = require('crypto-js');

const FritzOSCrypto = require('../lib/FritzOSCrypto.js');
const FritzExportChecksum = require('../lib/FritzExportChecksum.js');
const { API_VERSION, FritzExportEditor } = require('../src/FritzExportEditor.js');

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

  const structuralSource = result.updatedText.replace('FirmwareVersion=154.08.00', 'FirmwareVersion=154.08.01');
  const structuralSecret = Object.assign({}, result.replacements[0].verification, {
    id: 'structure-secret',
    value: result.replacements[0].newValue,
    plaintext: 'new value',
    status: 'decrypted',
    type: 4
  });
  const structuralResult = await FritzExportEditor.verifyWorkingCopy({
    text: structuralSource,
    password,
    secrets: [structuralSecret]
  });
  assert.match(structuralResult.updatedText, /FirmwareVersion=154\.08\.01/);
  assert.equal(structuralResult.roundtrip.count, 1);
  assert.equal(FritzExportEditor.verifyExportChecksum(structuralResult.updatedText).valid, true);

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

  const oldExportPassword = 'altes-export-kennwort';
  const newExportPassword = 'neues-export-kennwort';
  const wrappedMasterKey = await FritzOSCrypto.encryptExportKey(masterKey, oldExportPassword);
  const modernUnchecked = [
    '**** FRITZ!Box 7590 CONFIGURATION EXPORT',
    `Password=${wrappedMasterKey}`,
    '**** CFGFILE: wlan.cfg',
    `pskvalue = "${type5Secret}";`,
    '**** END OF FILE ****',
    '**** END OF EXPORT 00000000 ****',
    ''
  ].join('\r\n');
  const modernSource = FritzExportChecksum.fromText(modernUnchecked).replaceChecksum().updatedText;
  const passwordEvents = [];
  const passwordResult = await FritzExportEditor.changeExportPassword({
    text: modernSource,
    oldPassword: oldExportPassword,
    newPassword: newExportPassword,
    onStep: event => passwordEvents.push(`${event.step}:${event.status}`)
  });
  assert.deepEqual(passwordEvents, [
    'roundtrip:running',
    'roundtrip:success',
    'checksum:running',
    'checksum:success'
  ]);
  const changedMasterMatch = passwordResult.updatedText.match(/^Password=(\$\$\$\$\S+)/m);
  assert.ok(changedMasterMatch);
  assert.notEqual(changedMasterMatch[1], wrappedMasterKey);
  assert.equal(
    FritzOSCrypto.toHex(FritzOSCrypto.decryptExportKey(changedMasterMatch[1], newExportPassword).exportKeyBytes),
    FritzOSCrypto.toHex(masterKey)
  );
  assert.throws(() => FritzOSCrypto.decryptExportKey(changedMasterMatch[1], oldExportPassword));
  assert.equal(FritzOSCrypto.decryptSecretWithKey(type5Secret, masterKey).text, 'type5 old');
  assert.equal(passwordResult.roundtrip.payloadSecretsVerified, 1);
  assert.equal(passwordResult.checksum.valid, true);
  assert.deepEqual(FritzExportEditor.verifyExportChecksum(passwordResult.updatedText).valid, true);

  await assert.rejects(
    FritzExportEditor.changeExportPassword({
      text: modernSource,
      oldPassword: 'falsch',
      newPassword: newExportPassword
    }),
    error => error.code === 'OLD_PASSWORD_INVALID' && error.stage === 'roundtrip'
  );
  await assert.rejects(
    FritzExportEditor.changeExportPassword({
      text: source,
      oldPassword: password,
      newPassword: newExportPassword
    }),
    error => error.code === 'MODERN_MASTER_KEY_MISSING' && error.stage === 'setup'
  );
  const mixedUnchecked = modernUnchecked.replace(
    '**** END OF FILE ****',
    () => `legacy_password = "${originalSecret}";\r\n**** END OF FILE ****`
  );
  const mixedSource = FritzExportChecksum.fromText(mixedUnchecked).replaceChecksum().updatedText;
  assert.equal(FritzOSCrypto.FritzBoxParser.extractSecretInventory(mixedSource).length, 3);
  await assert.rejects(
    FritzExportEditor.changeExportPassword({
      text: mixedSource,
      oldPassword: oldExportPassword,
      newPassword: newExportPassword
    }),
    error => error.code === 'PASSWORD_BOUND_SECRET_FOUND' && error.stage === 'roundtrip'
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
