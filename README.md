# 🔐 FritzCryptoJs

*🇬🇧 [Read this in English](README_en.md)*

🚀 **[Live Demo & Tool im Browser öffnen](https://streetblock.github.io/fritzos-crypto/)**

Ein leichtgewichtiges, zu 100% lokal laufendes Browser-Tool und modular nutzbare Node.js-Bibliothek zum Entschlüsseln und Verschlüsseln von FRITZ!Box Konfigurationen (`.export` Dateien).

Das absolute Highlight: Dieses Tool unterstützt die moderne **FRITZ!OS 7.50+ Master-Key Architektur** (2-Stufen-Entschlüsselung) sowie alle älteren, auf PBKDF2 basierenden Legacy-Typen.

## ✨ Features

* **Moderne FRITZ!OS Unterstützung:** Knackt das neue Typ 5 / Typ 6 CBC-Master-Key-Verfahren (ab FRITZ!OS 7.50).

* **Abwärtskompatibel:** Unterstützt die klassischen AVM Typen 1 bis 4 (MD5+RC4, PBKDF2+AES-CBC, PBKDF2+AES-GCM).

* **100% Offline & Sicher:** Die HTML-Version läuft komplett lokal in deinem Browser. Es werden **keine** Konfigurationsdaten oder Passwörter an einen Server gesendet.

* **Verschlüsseln (Re-Encrypt):** Geänderte Klartext-Daten können wieder als Typ 4 (AES-GCM) verpackt werden, sodass die FRITZ!Box sie problemlos wieder importiert.

* **Modular:** Die reine Krypto-Logik ist in `FritzOSCrypto.js` ausgelagert und kann nahtlos in eigenen Node.js-Projekten genutzt werden.

## 🚀 Nutzung im Browser (UI)

Die einfachste Methode für Endanwender:

1. Lade das Repository herunter oder klone es.
2. Öffne die Datei `index.html` in einem beliebigen modernen Webbrowser (Chrome, Firefox, Safari).
3. Ziehe deine `.export` Datei per Drag & Drop in das Textfeld.
4. Gib das Passwort ein, das du beim Erstellen der Sicherung in der FRITZ!Box vergeben hast.
5. Klicke auf "Konfig entschlüsseln".

## 💻 Nutzung als Node.js Bibliothek

Für Entwickler, die die Entschlüsselung automatisieren möchten.

**1. Abhängigkeiten installieren:**

```bash
npm install pako crypto-js
```

**2. Modul einbinden und nutzen:**

```javascript
// WebCrypto für Node.js bereitstellen
const crypto = require('crypto');
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = crypto.webcrypto;
}
globalThis.pako = require('pako');
globalThis.CryptoJS = require('crypto-js');

// FritzOSCrypto laden
const { AVMCrypto } = require('./FritzOSCrypto.js');

async function decryptMyConfig() {
    const password = "DeinRouterPasswort123!";
    const encryptedString = "$$$$1234567890ABCDEF..."; // Dein AVM-String aus der .export
    
    try {
        const result = await AVMCrypto.decryptSecret(encryptedString, password);
        console.log("Erfolgreich entschlüsselt:", result.plaintext);
        console.log("Verwendeter Typ:", result.label);
    } catch (error) {
        console.error("Fehler beim Entschlüsseln:", error.message);
    }
}

decryptMyConfig();
```

## 🧪 Tests ausführen

Die mitgelieferte Test-Suite (`FritzOSCrypto.test.js`) verifiziert die gesamte Krypto-Kette.

```bash
npm install pako crypto-js
npm test
# Alternativ: node test/fritzoscrypto.test.js
```

## ⚠️ Sicherheitshinweis

FRITZ!Box `.export` Dateien enthalten hochsensible Daten (WLAN-Passwörter, SIP/VoIP-Zugangsdaten, DynDNS-Passwörter, PPP-Credentials).
**Lade niemals deine unzensierten `.export` Dateien oder extrahierte `$$$$`-Strings auf GitHub oder in öffentliche Foren hoch!** Das Repository enthält eine vorkonfigurierte `.gitignore`, die ein versehentliches Hochladen solcher Dateien verhindert.

## 📜 Lizenz

Copyright (c) 2026 David Block.
Veröffentlicht unter der [MIT Lizenz](LICENSE).

---
*Disclaimer: Dieses Projekt steht in keiner Verbindung zur AVM GmbH. FRITZ! und FRITZ!Box sind eingetragene Marken der AVM GmbH.*