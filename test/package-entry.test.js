const assert = require("node:assert/strict");
const api = require("..");

assert.equal(typeof globalThis.crypto.getRandomValues, "function");
assert.equal(typeof globalThis.pako.inflate, "function");
assert.equal(typeof globalThis.CryptoJS.AES.decrypt, "function");
assert.equal(typeof api.AVMCrypto.decryptSecret, "function");
assert.equal(typeof api.FritzBoxParser.extractSecretInventory, "function");
assert.equal(typeof api.FritzExportChecksum.fromText, "function");
assert.equal(typeof api.FritzExportEditor.changeExportPassword, "function");
assert.equal(typeof api.FritzExportEditor.rotateExportMasterKey, "function");
assert.equal(typeof api.FritzWireGuardKeys.derivePublicKey, "function");

console.log("package entry tests passed");
