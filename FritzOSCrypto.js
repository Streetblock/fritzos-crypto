/**
 * FritzOSCrypto.js
 * * JavaScript Library for decrypting and encrypting FRITZ!OS configuration secrets.
 * Includes support for legacy and modern FRITZ!OS 7.50+ Master-Key architectures.
 *
 * Copyright (c) 2026 David Block
 * License: MIT
 *
 * * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FritzOSCrypto = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var BLOCK_SIZE = 16;
  var AES256_KEY_SIZE = 32;
  var AVM_BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";

  function FritzOSCryptoError(message) {
    this.name = "FritzOSCryptoError";
    this.message = message;
  }

  FritzOSCryptoError.prototype = Object.create(Error.prototype);
  FritzOSCryptoError.prototype.constructor = FritzOSCryptoError;

  function fail(message) {
    throw new FritzOSCryptoError(message);
  }

  function isArrayBufferView(value) {
    return value && value.buffer instanceof ArrayBuffer && typeof value.byteLength === "number";
  }

  function toUint8Array(value, label) {
    if (value instanceof Uint8Array) {
      return new Uint8Array(value);
    }
    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value.slice(0));
    }
    if (isArrayBufferView(value)) {
      return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    }
    if (Array.isArray(value)) {
      return Uint8Array.from(value);
    }
    fail((label || "value") + " must be a Uint8Array, ArrayBuffer, typed array, or array");
  }

  function utf8Bytes(text) {
    if (typeof text !== "string") {
      fail("text must be a string");
    }
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(text);
    }
    var encoded = unescape(encodeURIComponent(text));
    var out = new Uint8Array(encoded.length);
    for (var i = 0; i < encoded.length; i += 1) {
      out[i] = encoded.charCodeAt(i);
    }
    return out;
  }

  function utf8String(bytes) {
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder().decode(bytes);
    }
    var text = "";
    for (var i = 0; i < bytes.length; i += 1) {
      text += String.fromCharCode(bytes[i]);
    }
    return decodeURIComponent(escape(text));
  }

  function toHex(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 1) {
      var byteHex = bytes[i].toString(16).toUpperCase();
      out += byteHex.length === 1 ? "0" + byteHex : byteHex;
    }
    return out;
  }

  function fromHex(hex) {
    if (typeof hex !== "string") {
      fail("hex key must be a string");
    }
    var normalized = hex.replace(/^0x/i, "").replace(/\s+/g, "");
    if (normalized.length !== 32 && normalized.length !== 64) {
      fail("hex key must contain 32 or 64 hexadecimal characters");
    }
    if (!/^[0-9a-fA-F]+$/.test(normalized)) {
      fail("hex key contains non-hexadecimal characters");
    }
    var out = new Uint8Array(normalized.length / 2);
    for (var i = 0; i < normalized.length; i += 2) {
      out[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
    }
    return out;
  }

  function normalizeAes256Key(key) {
    var keyBytes;
    if (typeof key === "string") {
      keyBytes = fromHex(key);
    } else {
      keyBytes = toUint8Array(key, "key");
    }
    if (keyBytes.length !== 16 && keyBytes.length !== 32) {
      fail("key must be 16 or 32 bytes long");
    }
    var normalized = new Uint8Array(AES256_KEY_SIZE);
    normalized.set(keyBytes.subarray(0, Math.min(keyBytes.length, AES256_KEY_SIZE)));
    return normalized;
  }

  function stripSecretPrefix(secret) {
    if (typeof secret !== "string") {
      fail("secret must be a string");
    }
    return secret.replace(/^\$+/, "").trim().toUpperCase();
  }

  function decodeAvmBase32(secret) {
    var normalized = stripSecretPrefix(secret);
    if (normalized.length === 0) {
      fail("secret is empty");
    }
    if (normalized.length % 8 !== 0) {
      fail("AVM Base32 data length must be a multiple of 8 characters");
    }
    var output = [];
    for (var offset = 0; offset < normalized.length; offset += 8) {
      var bits = 0;
      var value = 0;
      for (var index = 0; index < 8; index += 1) {
        var character = normalized.charAt(offset + index);
        var alphabetIndex = AVM_BASE32_ALPHABET.indexOf(character);
        if (alphabetIndex === -1) {
          fail("invalid AVM Base32 character: " + character);
        }
        value = value * 32 + alphabetIndex;
        bits += 5;
        if (bits >= 8) {
          var shift = bits - 8;
          var divisor = Math.pow(2, shift);
          output.push(Math.floor(value / divisor) & 0xff);
          bits -= 8;
          value = value % divisor;
        }
      }
    }
    return Uint8Array.from(output);
  }

  function encodeAvmBase32(bytes) {
    var input = toUint8Array(bytes, "bytes");
    if (input.length % 5 !== 0) {
      fail("AVM Base32 encoding requires an input length that is a multiple of 5 bytes");
    }
    var output = "";
    for (var offset = 0; offset < input.length; offset += 5) {
      var bits = 0;
      var value = 0;
      for (var index = 0; index < 5; index += 1) {
        value = value * 256 + input[offset + index];
        bits += 8;
        while (bits >= 5) {
          var shift = bits - 5;
          var divisor = Math.pow(2, shift);
          output += AVM_BASE32_ALPHABET.charAt(Math.floor(value / divisor));
          bits -= 5;
          value = value % divisor;
        }
      }
    }
    return output;
  }

  function leftRotate(value, shift) {
    return ((value << shift) | (value >>> (32 - shift))) >>> 0;
  }

  function md5(input) {
    var bytes = toUint8Array(input, "input");
    var originalLength = bytes.length;
    var paddedLength = (((originalLength + 8) >> 6) + 1) * 64;
    var padded = new Uint8Array(paddedLength);
    var bitLength = originalLength * 8;

    padded.set(bytes);
    padded[originalLength] = 0x80;

    padded[paddedLength - 8] = bitLength & 0xff;
    padded[paddedLength - 7] = (bitLength >>> 8) & 0xff;
    padded[paddedLength - 6] = (bitLength >>> 16) & 0xff;
    padded[paddedLength - 5] = (bitLength >>> 24) & 0xff;

    var a0 = 0x67452301;
    var b0 = 0xefcdab89;
    var c0 = 0x98badcfe;
    var d0 = 0x10325476;

    var s = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];
    var k = new Uint32Array(64);

    for (var i = 0; i < 64; i += 1) {
      k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    }

    for (var offset = 0; offset < padded.length; offset += 64) {
      var words = new Uint32Array(16);
      for (i = 0; i < 16; i += 1) {
        var base = offset + i * 4;
        words[i] = (
          padded[base] |
          (padded[base + 1] << 8) |
          (padded[base + 2] << 16) |
          (padded[base + 3] << 24)
        ) >>> 0;
      }
      var a = a0;
      var b = b0;
      var c = c0;
      var d = d0;

      for (i = 0; i < 64; i += 1) {
        var f;
        var g;
        if (i < 16) {
          f = (b & c) | (~b & d);
          g = i;
        } else if (i < 32) {
          f = (d & b) | (~d & c);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          f = b ^ c ^ d;
          g = (3 * i + 5) % 16;
        } else {
          f = c ^ (b | ~d);
          g = (7 * i) % 16;
        }
        var temp = d;
        d = c;
        c = b;
        b = (b + leftRotate((a + f + k[i] + words[g]) >>> 0, s[i])) >>> 0;
        a = temp;
      }
      a0 = (a0 + a) >>> 0;
      b0 = (b0 + b) >>> 0;
      c0 = (c0 + c) >>> 0;
      d0 = (d0 + d) >>> 0;
    }

    var digest = new Uint8Array(16);
    var state = [a0, b0, c0, d0];
    for (i = 0; i < state.length; i += 1) {
      digest[i * 4] = state[i] & 0xff;
      digest[i * 4 + 1] = (state[i] >>> 8) & 0xff;
      digest[i * 4 + 2] = (state[i] >>> 16) & 0xff;
      digest[i * 4 + 3] = (state[i] >>> 24) & 0xff;
    }
    return digest;
  }

  function gfMultiply(a, b) {
    var result = 0;
    var multiplicand = a;
    var multiplier = b;
    while (multiplier > 0) {
      if (multiplier & 1) {
        result ^= multiplicand;
      }
      multiplicand <<= 1;
      if (multiplicand & 0x100) {
        multiplicand ^= 0x11b;
      }
      multiplier >>= 1;
    }
    return result & 0xff;
  }

  function gfPower(base, exponent) {
    var result = 1;
    var value = base;
    var power = exponent;
    while (power > 0) {
      if (power & 1) {
        result = gfMultiply(result, value);
      }
      value = gfMultiply(value, value);
      power >>= 1;
    }
    return result;
  }

  function buildSBoxes() {
    var sBox = new Uint8Array(256);
    var invSBox = new Uint8Array(256);
    for (var i = 0; i < 256; i += 1) {
      var inverse = i === 0 ? 0 : gfPower(i, 254);
      var transformed = inverse ^
        ((inverse << 1) | (inverse >>> 7)) ^
        ((inverse << 2) | (inverse >>> 6)) ^
        ((inverse << 3) | (inverse >>> 5)) ^
        ((inverse << 4) | (inverse >>> 4)) ^
        0x63;

      sBox[i] = transformed & 0xff;
      invSBox[sBox[i]] = i;
    }
    return { sBox: sBox, invSBox: invSBox };
  }

  var sBoxes = buildSBoxes();
  var S_BOX = sBoxes.sBox;
  var INV_S_BOX = sBoxes.invSBox;

  function expandAes256Key(key) {
    var expanded = new Uint8Array(240);
    var rcon = 1;
    var bytesGenerated = 32;
    var temp = new Uint8Array(4);
    expanded.set(key);

    while (bytesGenerated < expanded.length) {
      temp[0] = expanded[bytesGenerated - 4];
      temp[1] = expanded[bytesGenerated - 3];
      temp[2] = expanded[bytesGenerated - 2];
      temp[3] = expanded[bytesGenerated - 1];

      if (bytesGenerated % 32 === 0) {
        var rotated = temp[0];
        temp[0] = S_BOX[temp[1]] ^ rcon;
        temp[1] = S_BOX[temp[2]];
        temp[2] = S_BOX[temp[3]];
        temp[3] = S_BOX[rotated];
        rcon = gfMultiply(rcon, 2);
      } else if (bytesGenerated % 32 === 16) {
        temp[0] = S_BOX[temp[0]];
        temp[1] = S_BOX[temp[1]];
        temp[2] = S_BOX[temp[2]];
        temp[3] = S_BOX[temp[3]];
      }

      for (var i = 0; i < 4; i += 1) {
        expanded[bytesGenerated] = expanded[bytesGenerated - 32] ^ temp[i];
        bytesGenerated += 1;
      }
    }
    return expanded;
  }

  function addRoundKey(state, expandedKey, round) {
    var keyOffset = round * 16;
    for (var i = 0; i < 16; i += 1) {
      state[i] ^= expandedKey[keyOffset + i];
    }
  }

  function invSubBytes(state) {
    for (var i = 0; i < 16; i += 1) {
      state[i] = INV_S_BOX[state[i]];
    }
  }

  function invShiftRows(state) {
    var copy = new Uint8Array(state);
    state[1] = copy[13];
    state[5] = copy[1];
    state[9] = copy[5];
    state[13] = copy[9];

    state[2] = copy[10];
    state[6] = copy[14];
    state[10] = copy[2];
    state[14] = copy[6];

    state[3] = copy[7];
    state[7] = copy[11];
    state[11] = copy[15];
    state[15] = copy[3];
  }

  function invMixColumns(state) {
    for (var column = 0; column < 4; column += 1) {
      var offset = column * 4;
      var a0 = state[offset];
      var a1 = state[offset + 1];
      var a2 = state[offset + 2];
      var a3 = state[offset + 3];

      state[offset] = gfMultiply(a0, 14) ^ gfMultiply(a1, 11) ^ gfMultiply(a2, 13) ^ gfMultiply(a3, 9);
      state[offset + 1] = gfMultiply(a0, 9) ^ gfMultiply(a1, 14) ^ gfMultiply(a2, 11) ^ gfMultiply(a3, 13);
      state[offset + 2] = gfMultiply(a0, 13) ^ gfMultiply(a1, 9) ^ gfMultiply(a2, 14) ^ gfMultiply(a3, 11);
      state[offset + 3] = gfMultiply(a0, 11) ^ gfMultiply(a1, 13) ^ gfMultiply(a2, 9) ^ gfMultiply(a3, 14);
    }
  }

  function decryptAes256Block(block, expandedKey) {
    var state = new Uint8Array(block);
    addRoundKey(state, expandedKey, 14);
    for (var round = 13; round >= 1; round -= 1) {
      invShiftRows(state);
      invSubBytes(state);
      addRoundKey(state, expandedKey, round);
      invMixColumns(state);
    }
    invShiftRows(state);
    invSubBytes(state);
    addRoundKey(state, expandedKey, 0);
    return state;
  }

  function decryptAes256CbcWithoutFinal(ciphertext, key, iv) {
    var input = toUint8Array(ciphertext, "ciphertext");
    var normalizedKey = normalizeAes256Key(key);
    var ivBytes = toUint8Array(iv, "iv");

    if (ivBytes.length !== BLOCK_SIZE) {
      fail("IV must be 16 bytes long");
    }

    var processLength = input.length - (input.length % BLOCK_SIZE);
    var expandedKey = expandAes256Key(normalizedKey);
    var output = new Uint8Array(processLength);
    var previous = ivBytes;

    for (var offset = 0; offset < processLength; offset += BLOCK_SIZE) {
      var cipherBlock = input.subarray(offset, offset + BLOCK_SIZE);
      var plainBlock = decryptAes256Block(cipherBlock, expandedKey);

      for (var index = 0; index < BLOCK_SIZE; index += 1) {
        output[offset + index] = plainBlock[index] ^ previous[index];
      }
      previous = cipherBlock;
    }
    return output;
  }

  function readUint32BE(bytes, offset) {
    return (
      bytes[offset] * 0x1000000 +
      ((bytes[offset + 1] << 16) >>> 0) +
      (bytes[offset + 2] << 8) +
      bytes[offset + 3]
    ) >>> 0;
  }

  function validateAndExtractValue(plaintext) {
    if (plaintext.length < 8) {
      fail("decrypted payload is too short");
    }

    var expectedDigest = md5(plaintext.subarray(4));
    for (var i = 0; i < 4; i += 1) {
      if (plaintext[i] !== expectedDigest[i]) {
        fail("digest validation failed; wrong password or key");
      }
    }

    var dataLength = readUint32BE(plaintext, 4);
    if (8 + dataLength > plaintext.length) {
      fail("decrypted payload announces a larger value than available");
    }

    var rawValue = plaintext.subarray(8, 8 + dataLength);
    var isString = rawValue.length > 0 && rawValue[rawValue.length - 1] === 0;
    var value = isString ? rawValue.subarray(0, rawValue.length - 1) : rawValue;

    return {
      rawValue: new Uint8Array(rawValue),
      value: new Uint8Array(value),
      valueLength: value.length,
      rawValueLength: rawValue.length,
      isString: isString
    };
  }

  function decryptSecretWithKey(secret, key) {
    var secretBytes = decodeAvmBase32(secret);
    if (secretBytes.length <= BLOCK_SIZE) {
      fail("secret does not contain an IV and ciphertext");
    }

    var iv = secretBytes.subarray(0, BLOCK_SIZE);
    var ciphertext = secretBytes.subarray(BLOCK_SIZE);
    var plaintext = decryptAes256CbcWithoutFinal(ciphertext, key, iv);
    var parsed = validateAndExtractValue(plaintext);

    return {
      secret: stripSecretPrefix(secret),
      iv: new Uint8Array(iv),
      ciphertext: new Uint8Array(ciphertext),
      plaintext: new Uint8Array(plaintext),
      bytes: parsed.value,
      rawBytes: parsed.rawValue,
      hex: toHex(parsed.value),
      rawHex: toHex(parsed.rawValue),
      isString: parsed.isString,
      text: parsed.isString ? utf8String(parsed.value) : null
    };
  }

  function derivePasswordKey(password) {
    var digest = md5(utf8Bytes(password));
    var key = new Uint8Array(AES256_KEY_SIZE);
    key.set(digest);

    return {
      bytes: key,
      hashBytes: digest,
      hex: toHex(key),
      hashHex: toHex(digest)
    };
  }

  function decryptExportKey(secret, password) {
    var passwordKey = derivePasswordKey(password);
    var result = decryptSecretWithKey(secret, passwordKey.bytes);

    if (result.rawBytes.length !== 32) {
      fail("export password entry must decrypt to 32 bytes");
    }

    var firstHalf = result.rawBytes.subarray(0, 16);
    var secondHalf = result.rawBytes.subarray(16, 32);

    for (var i = 0; i < 16; i += 1) {
      if (firstHalf[i] !== secondHalf[i]) {
        fail("export key halves do not match");
      }
    }

    var aesKey = normalizeAes256Key(firstHalf);

    return {
      passwordKey: passwordKey,
      exportKeyBytes: new Uint8Array(firstHalf),
      exportKeyHex: toHex(firstHalf),
      aesKeyBytes: aesKey,
      aesKeyHex: toHex(aesKey),
      details: result
    };
  }

  function decryptSecret(secret, keyOrPassword, options) {
    var opts = options || {};
    if (opts.password === true) {
      return decryptExportKey(secret, String(keyOrPassword));
    }
    return decryptSecretWithKey(secret, keyOrPassword);
  }

  // =========================================================================
  // HIGH-LEVEL KLASSEN: Integration aus ConfigTool (Typ 1-5 Entschlüsselung)
  // =========================================================================

  // Hilfsfunktion: Greift auf WebCrypto/CryptoJS zu, egal ob in Node oder Browser
  function getCrypto() {
      return typeof crypto !== 'undefined' ? crypto : (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
  }
  function getCryptoJS() {
      return typeof CryptoJS !== 'undefined' ? CryptoJS : (typeof globalThis !== 'undefined' ? globalThis.CryptoJS : null);
  }
  function getPako() {
      return typeof pako !== 'undefined' ? pako : (typeof globalThis !== 'undefined' ? globalThis.pako : null);
  }

  class AVMCrypto {
      static TYPE_LABELS = {
          1: 'Typ 1 / MD5 + RC4',
          2: 'Typ 2 / PBKDF2-SHA1 + AES-CBC',
          3: 'Typ 3 / PBKDF2-SHA256 + AES-CBC',
          4: 'Typ 4 / PBKDF2-SHA256 + AES-GCM',
          5: 'Typ 5 / Proprietär Master-Key (CBC)'
      };

      static stripPrefix(avmString) {
          return String(avmString || '').toUpperCase().replace(/^\$\$\$\$/, '').replace(/\s+/g, '').replace(/=+$/, '');
      }

      static readUInt32LE(bytes, offset = 0) {
          if (!bytes || bytes.length < offset + 4) return -1;
          return (bytes[offset]) | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
      }

      static decodeBitsCustom(str, alphabet, bitsPerChar) {
          let bits = 0;
          let bitCount = 0;
          const bytes = [];
          for (let i = 0; i < str.length; i++) {
              const value = alphabet.indexOf(str[i]);
              if (value === -1) continue;
              bits = (bits << bitsPerChar) | value;
              bitCount += bitsPerChar;
              while (bitCount >= 8) {
                  bitCount -= 8;
                  bytes.push((bits >> bitCount) & 0xFF);
              }
          }
          return new Uint8Array(bytes);
      }

      static decodeCandidates(avmString) {
          const body = this.stripPrefix(avmString);
          const candidates = [];
          const seen = new Set();

          const pushCandidate = (bytes, source) => {
              if (!(bytes instanceof Uint8Array) || bytes.length < 4) return;
              const signature = Array.from(bytes.slice(0, Math.min(bytes.length, 24))).join(',');
              if (seen.has(signature)) return;
              seen.add(signature);
              candidates.push({ bytes, source, type: this.readUInt32LE(bytes) });
          };

          pushCandidate(this.decodeBitsCustom(body, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456', 5), 'Fritz-Base32');
          pushCandidate(this.decodeBitsCustom(body, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', 5), 'Standard-Base32');

          const base64Alphabets = [
              { alphabet: './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', label: 'AVM-Base64 (Engelke)' },
              { alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz./', label: 'AVM-Base64 (0.0.8)' },
              { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', label: 'Standard-Base64' }
          ];

          for (const entry of base64Alphabets) {
              pushCandidate(this.decodeBitsCustom(body, entry.alphabet, 6), entry.label);
          }

          return candidates;
      }

      static sanitizeString(text) {
          return String(text ?? '').replace(/\0+$/g, '');
      }

      static looksPlausiblePlaintext(text) {
          if (typeof text !== 'string') return false;
          if (text.length === 0) return true;
          const cleaned = this.sanitizeString(text);
          if (cleaned.length === 0) return true;
          const replacementCount = (cleaned.match(/\uFFFD/g) || []).length;
          const controlCount = (cleaned.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
          const bad = replacementCount + controlCount;
          const ratio = 1 - (bad / cleaned.length);
          return ratio >= 0.85;
      }

      static decodeBufferToText(bufferLike) {
          const bytes = bufferLike instanceof Uint8Array ? bufferLike : new Uint8Array(bufferLike);
          const decoder = new TextDecoder();
          const pakoLib = getPako();
          try {
              if (pakoLib) {
                  const inflated = pakoLib.inflate(bytes);
                  const text = this.sanitizeString(decoder.decode(inflated));
                  if (this.looksPlausiblePlaintext(text)) return text;
              }
          } catch (error) {}

          const rawText = this.sanitizeString(decoder.decode(bytes));
          if (!this.looksPlausiblePlaintext(rawText)) throw new Error('BAD_PASSWORD');
          return rawText;
      }

      static async importPBKDF2Password(password) {
          const cr = getCrypto();
          return cr.subtle.importKey(
              'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
          );
      }

      static async deriveKey(password, salt, algorithm, length, iterations, hash) {
          const cr = getCrypto();
          const keyMaterial = await this.importPBKDF2Password(password);
          return cr.subtle.deriveKey(
              { name: 'PBKDF2', salt, iterations, hash },
              keyMaterial, { name: algorithm, length }, false, ['decrypt']
          );
      }

      static async decryptType1(password, salt, cipher) {
          const CJS = getCryptoJS();
          if (!CJS) throw new Error("CryptoJS missing");
          const passWA = CJS.enc.Utf8.parse(password);
          const saltWA = CJS.lib.WordArray.create(salt);
          const key = CJS.MD5(passWA.clone().concat(saltWA));
          const cipherWA = CJS.lib.WordArray.create(cipher);
          const decryptedWA = CJS.RC4.decrypt({ ciphertext: cipherWA }, key);
          const result = CJS.enc.Utf8.stringify(decryptedWA);
          if (!result && cipherWA.sigBytes > 0) throw new Error('BAD_PASSWORD');
          return { plaintext: this.sanitizeString(result), saltLen: 8, layout: 'salt8' };
      }

      static async decryptAESCBC(password, salt, iv, cipher, iterations, hash) {
          const cr = getCrypto();
          const key = await this.deriveKey(password, salt, 'AES-CBC', 256, iterations, hash);
          const decrypted = await cr.subtle.decrypt({ name: 'AES-CBC', iv }, key, cipher);
          return this.decodeBufferToText(decrypted);
      }

      static async decryptAESGCM(password, salt, iv, cipherWithTag, iterations, hash) {
          const cr = getCrypto();
          const key = await this.deriveKey(password, salt, 'AES-GCM', 256, iterations, hash);
          const decrypted = await cr.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherWithTag);
          return this.decodeBufferToText(decrypted);
      }

      static async tryLayoutSeries(bytes, type, password, layouts) {
          const errors = [];
          for (const layout of layouts) {
              const { saltLen, ivLen, iterations, hash, algorithm } = layout;
              const headerLen = 4 + saltLen + ivLen;
              if (bytes.length <= headerLen) continue;

              const salt = bytes.slice(4, 4 + saltLen);
              const iv = bytes.slice(4 + saltLen, 4 + saltLen + ivLen);
              const payload = bytes.slice(headerLen);

              try {
                  let plaintext;
                  if (algorithm === 'AES-CBC') {
                      plaintext = await this.decryptAESCBC(password, salt, iv, payload, iterations, hash);
                  } else {
                      plaintext = await this.decryptAESGCM(password, salt, iv, payload, iterations, hash);
                  }
                  return { plaintext, saltLen, layout: `salt${saltLen}/iv${ivLen}`, type, algorithm, iterations, hash };
              } catch (error) {
                  errors.push(error);
              }
          }
          if (errors.length) throw new Error('BAD_PASSWORD');
          throw new Error('NOT_A_SECRET');
      }

      static async decryptSecret(avmString, password, activeMasterKeyBytes = null) {
          let lastBadPassword = null;
          let lastError = null;

          // 1. Priorität: Proprietäres FritzOSCrypto-Verfahren (Typ 5) intern aufrufen
          try {
              const keyToUse = activeMasterKeyBytes || password;
              const res = decryptSecret(avmString, keyToUse);
              return {
                  plaintext: res.isString ? res.text : '(Binärdaten)',
                  rawValue: res.rawBytes,
                  type: 5,
                  label: AVMCrypto.TYPE_LABELS[5],
                  source: 'FritzOSCrypto',
                  saltLen: 0,
                  layout: 'AVM-Proprietary',
                  algorithm: 'AES-256-CBC-Legacy'
              };
          } catch (e) {
              if (e.message.includes('wrong password') || e.message.includes('digest validation failed')) {
                  lastBadPassword = e;
              }
          }

          // 2. Fallback: Moderne PBKDF2 Entschlüsselung (Typ 1-4)
          const candidates = this.decodeCandidates(avmString);
          for (const candidate of candidates) {
              const { bytes, source, type } = candidate;
              try {
                  let result;
                  if (type === 1) {
                      if (bytes.length < 12) throw new Error('NOT_A_SECRET');
                      result = await this.decryptType1(password, bytes.slice(4, 12), bytes.slice(12));
                  } else if (type === 2) {
                      result = await this.tryLayoutSeries(bytes, type, password, [
                          { saltLen: 8, ivLen: 16, iterations: 1000, hash: 'SHA-1', algorithm: 'AES-CBC' }
                      ]);
                  } else if (type === 3) {
                      result = await this.tryLayoutSeries(bytes, type, password, [
                          { saltLen: 16, ivLen: 16, iterations: 100000, hash: 'SHA-256', algorithm: 'AES-CBC' },
                          { saltLen: 8, ivLen: 16, iterations: 100000, hash: 'SHA-256', algorithm: 'AES-CBC' }
                      ]);
                  } else if (type === 4) {
                      result = await this.tryLayoutSeries(bytes, type, password, [
                          { saltLen: 16, ivLen: 12, iterations: 100000, hash: 'SHA-256', algorithm: 'AES-GCM' },
                          { saltLen: 8, ivLen: 12, iterations: 100000, hash: 'SHA-256', algorithm: 'AES-GCM' }
                      ]);
                  } else {
                      throw new Error('NOT_A_SECRET');
                  }

                  return {
                      plaintext: result.plaintext,
                      type,
                      label: AVMCrypto.TYPE_LABELS[type] || `Typ ${type}`,
                      source,
                      saltLen: result.saltLen,
                      layout: result.layout || '',
                      algorithm: result.algorithm || (type === 1 ? 'RC4' : 'AES')
                  };
              } catch (error) {
                  if (error.message === 'BAD_PASSWORD') lastBadPassword = error;
                  else lastError = error;
              }
          }
          
          if (lastBadPassword) throw lastBadPassword;
          throw lastError || new Error('NOT_A_SECRET');
      }

      static async encryptSecret(text, password) {
          const cr = getCrypto();
          const pakoLib = getPako();
          if (!cr || !pakoLib) throw new Error("WebCrypto API or Pako missing");

          const salt = cr.getRandomValues(new Uint8Array(16));
          const iv = cr.getRandomValues(new Uint8Array(12));
          const keyMaterial = await this.importPBKDF2Password(password);
          const key = await cr.subtle.deriveKey(
              { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
              keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
          );

          const encoded = new TextEncoder().encode(text);
          const compressed = pakoLib.deflate(encoded);
          const encrypted = await cr.subtle.encrypt({ name: 'AES-GCM', iv }, key, compressed);

          const payload = new Uint8Array(4 + 16 + 12 + encrypted.byteLength);
          payload.set([0x04, 0x00, 0x00, 0x00], 0);
          payload.set(salt, 4);
          payload.set(iv, 20);
          payload.set(new Uint8Array(encrypted), 32);

          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';
          let bits = 0;
          let bitCount = 0;
          let output = '';

          for (let i = 0; i < payload.length; i++) {
              bits = (bits << 8) | payload[i];
              bitCount += 8;
              while (bitCount >= 5) {
                  bitCount -= 5;
                  output += alphabet[(bits >> bitCount) & 31];
              }
          }
          if (bitCount > 0) output += alphabet[(bits << (5 - bitCount)) & 31];
          const padCount = (8 - (output.length % 8)) % 8;
          if (padCount > 0) output += '='.repeat(padCount);

          return '$$$$' + output;
      }
  }

  class FritzBoxParser {
      static isExportFile(text) {
          return text.includes('**** FRITZ!Box') && text.includes('CONFIGURATION EXPORT');
      }

      static parseHeader(headerText) {
          const meta = {};
          const lines = headerText.split('\n');
          const modelMatch = lines[0]?.match(/\*\*\*\*\s+FRITZ!Box\s+(.+?)\s+CONFIG/);
          if (modelMatch) meta['Modell'] = modelMatch[1].trim();

          for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line || line.startsWith('//')) continue;
              const eqIndex = line.indexOf('=');
              if (eqIndex > 0) {
                  const key = line.substring(0, eqIndex).trim();
                  const value = line.substring(eqIndex + 1).trim();
                  meta[key] = value;
              }
          }
          return meta;
      }

      static extractSecrets(text) {
          const regex = /\$\$\$\$[A-Za-z0-9./+=_-]+/g;
          const matches = text.match(regex) || [];
          return [...new Set(matches)];
      }
  }

  return {
    FritzOSCryptoError: FritzOSCryptoError,
    BLOCK_SIZE: BLOCK_SIZE,
    AES256_KEY_SIZE: AES256_KEY_SIZE,
    AVM_BASE32_ALPHABET: AVM_BASE32_ALPHABET,
    stripSecretPrefix: stripSecretPrefix,
    decodeAvmBase32: decodeAvmBase32,
    encodeAvmBase32: encodeAvmBase32,
    md5: md5,
    toHex: toHex,
    fromHex: fromHex,
    normalizeAes256Key: normalizeAes256Key,
    derivePasswordKey: derivePasswordKey,
    decryptSecretWithKey: decryptSecretWithKey,
    decryptExportKey: decryptExportKey,
    decryptSecret: decryptSecret,
    // Neue asynchrone High-Level Interfaces:
    AVMCrypto: AVMCrypto,
    FritzBoxParser: FritzBoxParser
  };
});