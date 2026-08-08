# 🔐 FritzCryptoJs

*🇩🇪 [Auf Deutsch lesen](README.md)*

🚀 **[Open Live Demo & Tool in Browser](https://streetblock.github.io/fritzos-crypto/)**

A lightweight browser tool and modular Node.js library for decrypting secrets in FRITZ!Box configuration exports (`.export` files).

The absolute highlight: This tool supports the modern **FRITZ!OS 7.50+ Master-Key architecture** (2-stage decryption) as well as all older PBKDF2-based legacy encryption types.

## ✨ Features

* **Modern FRITZ!OS Support:** Supports the Type 5 CBC Master-Key method introduced in FRITZ!OS 7.50 and newer.

* **Backwards Compatible:** Supports the classic AVM Types 1 through 4 (MD5+RC4, PBKDF2+AES-CBC, PBKDF2+AES-GCM).

* **Local processing:** Configuration data and passwords are processed in the browser. The current HTML version still loads its JavaScript dependencies from CDNs and therefore requires an internet connection.

* **Edit secrets selectively:** Decrypted Type 4 and Type 5 values can be changed individually and re-encrypted in the working copy. Every new value is verified through a decryption roundtrip. This does not guarantee that an arbitrarily restructured backup file is importable.

* **Change the export password:** For modern exports, the existing export master key can be protected with a new password without changing the key itself. The master-key roundtrip, bound payload secrets, and CRC32 are verified before download. Mixed exports containing secrets still bound directly to the old password are rejected safely.

* **View embedded files:** Phonebook files are decoded locally and presented by phonebook and contact on a dedicated read-only page. Other unencrypted `B64FILE` blocks can be expanded individually; text is shown directly and binary data as a hex preview. The overview shows the number of detected phonebooks and contacts.

* **Sipgate webphone:** Fully decrypted Sipgate accounts can be connected deliberately using the officially supported WSS endpoint. Embedded phonebooks act as a contact picker. Unknown providers and Telekom accounts never receive a guessed WebSocket endpoint, and selecting a contact never starts a call by itself.

* **AVM checksum:** After re-encryption and before saving an export, the CRC32 value at `END OF EXPORT` is updated using AVM's section-aware procedure and verified again.

* **Modular:** Crypto, export checksums, and the atomic editing workflow are separated and can be used directly in Node.js projects.

## 🧩 Library structure

* `FritzOSCrypto.js`: Secret encryption/decryption and structured occurrence detection.
* `FritzExportChecksum.js`: Calculate, replace, and verify the AVM CRC32.
* `FritzExportEditor.js`: Apply edits atomically. It verifies the existing ciphertext, encrypts the new value, performs the secret roundtrip, and then updates CRC32.
* `ConfigState.js`: UI state for pending and validated changes; no cryptography.
* `FritzEmbeddedFiles.js`: Detect embedded B64 files and read supported content such as phonebooks without modifying it.
* `FritzSipWebPhone.js`: Allowlisted SIP-over-WSS provider profiles, dial-target validation, and the browser SIP/WebRTC session workflow.

`FritzExportEditor.applySecretChanges()` and `FritzExportEditor.changeExportPassword()` return a new export text only when every verification step succeeds. The provided text remains unchanged on failure.

## 🚀 Usage in Browser (UI)

The easiest method for end-users:

1. Download or clone this repository.
2. Open the `index.html` file in any modern web browser (Chrome, Firefox, Safari).
3. Drag and drop your `.export` file onto the large start area or select it there.
4. Enter the password you assigned when creating the backup in the FRITZ!Box web interface.
5. Click "Decrypt secrets". Results appear in the **Secrets** area, while the complete text remains available in the optional **Expert editor**.

## 💻 Usage as a Node.js Library

For developers looking to automate decryption or build backend tools.

**1. Install dependencies:**

```bash
npm install pako crypto-js
```

**2. Import and use the module:**

```javascript
// Provide WebCrypto for Node.js
const crypto = require('crypto');
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = crypto.webcrypto;
}
globalThis.pako = require('pako');
globalThis.CryptoJS = require('crypto-js');

// Load FritzOSCrypto
const { AVMCrypto } = require('./FritzOSCrypto.js');

async function decryptMyConfig() {
    const password = "YourRouterPassword123!";
    const encryptedString = "$$$$1234567890ABCDEF..."; // Your AVM string from the .export file
    
    try {
        const result = await AVMCrypto.decryptSecret(encryptedString, password);
        console.log("Successfully decrypted:", result.plaintext);
        console.log("Encryption Type used:", result.label);
    } catch (error) {
        console.error("Decryption failed:", error.message);
    }
}

decryptMyConfig();
```

## 🧪 Running Tests

The included test suite (`FritzOSCrypto.test.js`) verifies the entire cryptography chain.

```bash
npm install pako crypto-js
npm test
# Alternatively: node test/fritzoscrypto.test.js
```

## ⚠️ Security Warning

FRITZ!Box `.export` files contain highly sensitive data (Wi-Fi passwords, SIP/VoIP credentials, DynDNS passwords, PPP credentials).
**Never upload your uncensored `.export` files or extracted `$$$$` strings to GitHub or public forums!** This repository includes a preconfigured `.gitignore` file that prevents you from accidentally committing such files.

## 📜 License

Copyright (c) 2026 David Block.
Published under the [MIT License](LICENSE).

---
*Disclaimer: This project is not affiliated with AVM GmbH in any way. FRITZ! and FRITZ!Box are registered trademarks of AVM GmbH.*
