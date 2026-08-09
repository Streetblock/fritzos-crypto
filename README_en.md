# fritzos-crypto

*[Deutsche Version](README.md)*

A JavaScript library for reading, decrypting, encrypting, and safely updating FRITZ!Box export files. The `main` branch intentionally contains only the reusable core, small examples, and core tests.

The complete user interface is maintained separately:

- [Secret Finder web app](https://streetblock.github.io/fritzos-crypto/)
- [App source in the `app/secret-finder` branch](https://github.com/Streetblock/fritzos-crypto/tree/app/secret-finder)

## Features

- AVM secret types 1 through 4 and modern type-5 secrets introduced with FRITZ!OS 7.50
- two-stage decryption using the password-protected export master key
- structured secret discovery with file, field, line, and category metadata
- targeted re-encryption of changed secrets
- export-password changes without changing the export master key
- atomic export-master-key rotation including all bound type-5 secrets
- AVM-compatible CRC32 calculation, replacement, and validation
- WireGuard public-key derivation from validated private keys
- Node.js and direct browser usage

Every write operation in `FritzExportEditor` creates a new string and returns it only after a successful secret roundtrip and CRC32 validation. The input text is never mutated.

## Layout

```text
lib/
  index.js                    central package entry point
  FritzOSCrypto.js            secret crypto and structured discovery
  FritzExportChecksum.js      AVM CRC32
  FritzExportEditor.js        atomic export updates
  FritzWireGuardKeys.js       Curve25519 key derivation
examples/
  browser/                    small local browser example
  node/inspect-export.js      minimal Node.js example
test/                         focused core tests
```

SIP cards, phonebooks, webphone support, the expert editor, and other UI models belong to the app and are therefore not part of `main`.

## Node.js

After cloning the repository:

```bash
npm install
```

The package entry point exposes the public building blocks:

```javascript
const {
  FritzOSCrypto,
  AVMCrypto,
  FritzBoxParser,
  FritzExportChecksum,
  FritzExportEditor,
  FritzWireGuardKeys
} = require("fritzos-crypto");
```

Under Node.js, the package entry point loads `crypto-js`, `pako`, TweetNaCl, and WebCrypto when needed.

Run the included inspection example like this on PowerShell:

```powershell
$env:FRITZ_EXPORT_PASSWORD="your-export-password"
node .\examples\node\inspect-export.js C:\path\to\backup.export
```

The example prints sensitive values to the console. Only run it in a trusted local environment.

### Change the export password

```javascript
const result = await FritzExportEditor.changeExportPassword({
  text: exportText,
  oldPassword: "old password",
  newPassword: "new password"
});

// Only returned after the master-key roundtrip, payload checks, and CRC32 validation:
const verifiedExportText = result.updatedText;
```

### Rotate the export master key

```javascript
const result = await FritzExportEditor.rotateExportMasterKey({
  text: exportText,
  password: "export password"
  // crypto.getRandomValues() is used when newMasterKeyBytes is omitted.
});
```

## Browser example

Open [examples/browser/index.html](examples/browser/index.html) in a modern browser. The example deliberately shows only:

- model and firmware
- main and guest Wi-Fi
- the masked export master key
- verified export-password changes

Files and passwords never leave the browser. The example currently loads `pako` and `crypto-js` from jsDelivr, so it needs an internet connection when opened.

## Tests

```bash
npm test
```

The suite covers the package entry point, secret inventory, WireGuard key derivation, CRC32, atomic export editing, and all supported crypto roundtrips.

## Security

FRITZ!Box exports contain Wi-Fi, SIP, VPN, provider, and user credentials. Never publish unredacted `.export` files or extracted `$$$$` values. The included `.gitignore` blocks common export-file names.

## License

Copyright (c) 2026 David Block. Released under the MIT License. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering adapted components.

This project is not affiliated with AVM GmbH. FRITZ! and FRITZ!Box are registered trademarks of AVM GmbH.
