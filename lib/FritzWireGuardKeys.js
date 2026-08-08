(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("tweetnacl"));
  } else {
    root.FritzWireGuardKeys = factory(root.nacl);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (nacl) {
  "use strict";

  const API_VERSION = "1";
  const WIREGUARD_KEY_BYTES = 32;
  const BASE64_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;

  function assertDependency() {
    if (!nacl || !nacl.scalarMult || typeof nacl.scalarMult.base !== "function") {
      throw new Error("TweetNaCl mit Curve25519-Unterstützung ist nicht geladen");
    }
  }

  function encodeBase64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function decodePrivateKey(privateKeyBase64) {
    const encoded = String(privateKeyBase64 == null ? "" : privateKeyBase64).trim();
    if (!BASE64_KEY_PATTERN.test(encoded)) {
      throw new Error("Der WireGuard Private Key muss gültiges Base64 mit 44 Zeichen sein");
    }
    let bytes;
    try {
      if (typeof Buffer !== "undefined") {
        bytes = new Uint8Array(Buffer.from(encoded, "base64"));
      } else {
        const binary = atob(encoded);
        bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      }
    } catch (_error) {
      throw new Error("Der WireGuard Private Key ist kein gültiger Base64-Wert");
    }
    if (bytes.length !== WIREGUARD_KEY_BYTES || encodeBase64(bytes) !== encoded) {
      throw new Error("Der WireGuard Private Key muss genau 32 Byte enthalten");
    }
    return bytes;
  }

  function derivePublicKey(privateKeyBase64) {
    assertDependency();
    const privateKey = decodePrivateKey(privateKeyBase64);
    return encodeBase64(nacl.scalarMult.base(privateKey));
  }

  return {
    API_VERSION,
    WIREGUARD_KEY_BYTES,
    decodePrivateKey,
    derivePublicKey
  };
});
