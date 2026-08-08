const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

if (typeof globalThis.crypto === 'undefined') globalThis.crypto = nodeCrypto.webcrypto;
globalThis.pako = require('pako');
globalThis.CryptoJS = require('crypto-js');

const WireGuardKeys = require('../lib/FritzWireGuardKeys.js');
const FritzOSCrypto = require('../lib/FritzOSCrypto.js');
const FritzExportChecksum = require('../lib/FritzExportChecksum.js');
const Config = require('../src/FritzConfigDocument.js');
const WireGuard = require('../src/FritzWireGuardConnections.js');
const { FritzExportEditor } = require('../src/FritzExportEditor.js');

async function run() {
  const rfcPrivate = Buffer.from('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a', 'hex').toString('base64');
  const rfcPublic = Buffer.from('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a', 'hex').toString('base64');
  assert.equal(WireGuardKeys.derivePublicKey(rfcPrivate), rfcPublic, 'RFC 7748 X25519 public key must match');
  assert.throws(() => WireGuardKeys.derivePublicKey('dG9vLXNob3J0'), /44 Zeichen|32 Byte/);

  const password = 'wireguard-export-password';
  const oldPrivate = Buffer.alloc(32, 7).toString('base64');
  const newPrivate = Buffer.from(Array.from({ length: 32 }, (_value, index) => index + 1)).toString('base64');
  const oldPublic = WireGuardKeys.derivePublicKey(oldPrivate);
  const newPublic = WireGuardKeys.derivePublicKey(newPrivate);
  const encryptedPrivate = await FritzOSCrypto.AVMCrypto.encryptSecret(oldPrivate, password);
  const unchecked = [
    '**** FRITZ!Box 7590 CONFIGURATION EXPORT',
    '**** CFGFILE:vpn.cfg',
    'vpncfg {',
    '  vpncfg_version = 4;',
    `  global { wg_private_key = "${encryptedPrivate}"; wg_public_key = "${oldPublic}"; wg_listen_port = 51820; }`,
    '  connections { enabled = yes; wg_configured = yes; name = "Phone"; wg_public_key = "peer-public-key"; wg_allowed_ips = "0.0.0.0/0"; }',
    '}',
    '**** END OF FILE ****',
    '**** END OF EXPORT 00000000 ****',
    ''
  ].join('\r\n');
  const source = FritzExportChecksum.fromText(unchecked).replaceChecksum().updatedText;
  const privateSecret = FritzOSCrypto.FritzBoxParser.extractSecretInventory(source)
    .find(secret => secret.field === 'wg_private_key');
  assert.ok(privateSecret, 'global WireGuard private key must be detected');

  const result = await FritzExportEditor.applySecretChanges({
    text: source,
    password,
    changes: [Object.assign({}, privateSecret, {
      type: 4,
      plaintext: oldPrivate,
      editedPlaintext: newPrivate
    })],
    transformText(updatedText) {
      const document = Config.parse(updatedText);
      const model = WireGuard.project(document);
      return {
        text: WireGuard.update(document, model.global, { wg_public_key: newPublic }),
        linkedChanges: [{ kind: 'wireguard-public-key', value: newPublic }]
      };
    }
  });

  assert.equal(result.linkedChanges[0].value, newPublic);
  const updatedModel = WireGuard.project(Config.parse(result.updatedText));
  assert.equal(updatedModel.global.values.wg_public_key, newPublic);
  assert.equal(updatedModel.connections[0].values.wg_public_key, 'peer-public-key');
  const verified = FritzExportChecksum.fromText(result.updatedText).calculate();
  assert.equal(verified.oldCrc, verified.newCrc);
  const decrypted = await FritzOSCrypto.AVMCrypto.decryptSecret(result.replacements[0].newValue, password);
  assert.equal(decrypted.plaintext, newPrivate);

  console.log('WireGuard key derivation and linked export update tests passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
