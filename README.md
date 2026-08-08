# 🔐 FritzCryptoJs

*🇬🇧 [Read this in English](README_en.md)*

🚀 **[Live Demo & Tool im Browser öffnen](https://streetblock.github.io/fritzos-crypto/)**

Ein leichtgewichtiges Browser-Tool und eine modular nutzbare Node.js-Bibliothek zum Entschlüsseln von Geheimnissen in FRITZ!Box-Konfigurationen (`.export` Dateien).

Das absolute Highlight: Dieses Tool unterstützt die moderne **FRITZ!OS 7.50+ Master-Key Architektur** (2-Stufen-Entschlüsselung) sowie alle älteren, auf PBKDF2 basierenden Legacy-Typen.

## ✨ Features

* **Moderne FRITZ!OS Unterstützung:** Unterstützt das Typ-5-CBC-Master-Key-Verfahren (ab FRITZ!OS 7.50).

* **Abwärtskompatibel:** Unterstützt die klassischen AVM Typen 1 bis 4 (MD5+RC4, PBKDF2+AES-CBC, PBKDF2+AES-GCM).

* **Lokale Verarbeitung:** Konfigurationsdaten und Kennwörter werden im Browser verarbeitet. Die aktuelle HTML-Version lädt ihre JavaScript-Abhängigkeiten allerdings noch von CDNs und benötigt dafür eine Internetverbindung.

* **Secrets gezielt bearbeiten:** Entschlüsselte Typ-4- und Typ-5-Werte können einzeln geändert und in der Arbeitskopie neu verschlüsselt werden. Jeder neue Wert wird per Entschlüsselungs-Roundtrip geprüft. Daraus folgt noch keine Garantie, dass eine beliebig strukturell veränderte Sicherungsdatei importierbar ist.

* **Sicherungskennwort ändern:** Bei modernen Exporten kann der vorhandene Export-Master-Key unverändert mit einem neuen Sicherungskennwort geschützt werden. Master-Key-Roundtrip, gebundene Nutz-Secrets und CRC32 werden vor dem Download geprüft. Gemischte Exporte mit noch direkt kennwortgebundenen Secrets werden sicher abgelehnt.

* **Eingebettete Dateien ansehen:** Telefonbuchdateien werden lokal dekodiert und auf einer eigenen schreibgeschützten Seite nach Telefonbüchern und Kontakten gegliedert. Weitere unverschlüsselte `B64FILE`-Blöcke lassen sich dort einzeln ausklappen; Text wird direkt, Binärdaten werden als Hex-Vorschau angezeigt. Die Übersicht zeigt die Anzahl der erkannten Telefonbücher und Kontakte.

* **Sipgate-Webphone:** Vollständig entschlüsselte Sipgate-Konten können bewusst mit der offiziell unterstützten WSS-Adresse verbunden werden. Eingebettete Telefonbücher dienen als Wählhilfe. Unbekannte Provider und Telekom-Konten erhalten keinen geratenen WebSocket-Endpunkt; Kontaktwahl und Anruf bleiben getrennte Aktionen.

* **AVM-Prüfsumme:** Nach der Neuverschlüsselung und vor dem Speichern einer Exportdatei wird die CRC32-Prüfsumme am `END OF EXPORT` nach dem AVM-Sektionsverfahren aktualisiert und erneut geprüft.

* **Modular:** Krypto, Export-Prüfsumme und der atomare Bearbeitungsablauf sind voneinander getrennt und können in eigenen Node.js-Projekten genutzt werden.

## 🧩 Bibliotheksaufbau

* `lib/FritzOSCrypto.js`: Secret-Ver- und Entschlüsselung sowie strukturierte Fundstellenerkennung.
* `lib/FritzExportChecksum.js`: AVM-CRC32 berechnen, ersetzen und prüfen.
* `src/FritzExportEditor.js`: Änderungen atomar anwenden. Der Dienst prüft zuerst den vorhandenen Chiffretext, verschlüsselt den neuen Wert, führt den Secret-Roundtrip aus und aktualisiert anschließend CRC32.
* `src/ConfigState.js`: UI-Zustand wie offene und validierte Änderungen; keine Kryptografie.
* `src/FritzEmbeddedFiles.js`: Eingebettete B64-Dateien erkennen und unterstützte Inhalte wie Telefonbücher schreibgeschützt auslesen.
* `src/FritzSipWebPhone.js`: Freigegebene SIP-over-WSS-Providerprofile, Rufnummernvalidierung und browserseitiger SIP/WebRTC-Sitzungsablauf.
* `src/SipWebPhoneProviders.json`: Gepflegte Auflösungstabelle von exakten `registrar`-Werten zu Provider- und WSS-Konfigurationen. `src/SipWebPhoneProviders.js` wird daraus für die direkte lokale Browsernutzung erzeugt und darf nicht von Hand bearbeitet werden.

`FritzExportEditor.applySecretChanges()` und `FritzExportEditor.changeExportPassword()` geben nur dann einen neuen Exporttext zurück, wenn alle Prüfschritte erfolgreich waren. Bei einem Fehler bleibt der übergebene Text unverändert.

## 🚀 Nutzung im Browser (UI)

Die einfachste Methode für Endanwender:

1. Lade das Repository herunter oder klone es.
2. Öffne die Datei `index.html` in einem beliebigen modernen Webbrowser (Chrome, Firefox, Safari).
3. Ziehe deine `.export` Datei auf das große Startfeld oder wähle sie dort aus.
4. Gib das Passwort ein, das du beim Erstellen der Sicherung in der FRITZ!Box vergeben hast.
5. Klicke auf "Secrets entschlüsseln". Die Ergebnisse erscheinen im Bereich **Secrets**; der vollständige Text bleibt im optionalen **Experten-Editor** verfügbar.

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
const { AVMCrypto } = require('./lib/FritzOSCrypto.js');

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
