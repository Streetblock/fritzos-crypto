const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

if (typeof globalThis.crypto === 'undefined') globalThis.crypto = nodeCrypto.webcrypto;
globalThis.pako = require('pako');
globalThis.CryptoJS = require('crypto-js');

const WireGuardKeys = require('../lib/FritzWireGuardKeys.js');

async function run() {
  const rfcPrivate = Buffer.from('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a', 'hex').toString('base64');
  const rfcPublic = Buffer.from('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a', 'hex').toString('base64');
  assert.equal(WireGuardKeys.derivePublicKey(rfcPrivate), rfcPublic, 'RFC 7748 X25519 public key must match');
  assert.throws(() => WireGuardKeys.derivePublicKey('dG9vLXNob3J0'), /44 Zeichen|32 Byte/);

  console.log('WireGuard key derivation tests passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
