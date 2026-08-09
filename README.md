# fritzos-crypto

*[Read this in English](README_en.md)*

JavaScript-Bibliothek zum Lesen, Ver- und Entschlüsseln sowie sicheren Aktualisieren von FRITZ!Box-Exportdateien. `main` enthält bewusst nur den wiederverwendbaren Kern, kleine Beispiele und die Core-Tests.

Die vollständige Benutzeroberfläche wird getrennt gepflegt:

- [Secret Finder als Web-App](https://streetblock.github.io/fritzos-crypto/)
- [Quellcode der App im Branch `app/secret-finder`](https://github.com/Streetblock/fritzos-crypto/tree/app/secret-finder)

## Funktionen

- AVM-Secret-Typen 1 bis 4 sowie moderne Typ-5-Secrets ab FRITZ!OS 7.50
- zweistufige Entschlüsselung über den kennwortgeschützten Export-Master-Key
- strukturierte Secret-Erkennung mit Datei, Feld, Zeile und Kategorie
- gezielte Neuverschlüsselung geänderter Secrets
- Wechsel des Sicherungskennworts bei unverändertem Export-Master-Key
- atomare Rotation des Export-Master-Keys samt aller gebundenen Typ-5-Secrets
- AVM-kompatible CRC32-Berechnung, Aktualisierung und Kontrolle
- Ableitung öffentlicher WireGuard-Schlüssel aus gültigen privaten Schlüsseln
- Nutzung unter Node.js und direkt im Browser

Alle Schreiboperationen des `FritzExportEditor` erzeugen einen neuen Text und liefern ihn erst nach erfolgreichem Secret-Roundtrip und gültiger CRC32-Prüfung zurück. Der übergebene Originaltext wird nicht verändert.

## Aufbau

```text
lib/
  index.js                    zentraler Paketeinstieg
  FritzOSCrypto.js            Secret-Krypto und Fundstellenerkennung
  FritzExportChecksum.js      AVM-CRC32
  FritzExportEditor.js        atomare Exportänderungen
  FritzWireGuardKeys.js       Curve25519-Schlüsselableitung
examples/
  browser/                    kleines lokales Browserbeispiel
  node/inspect-export.js      minimales Node.js-Beispiel
test/                         fokussierte Core-Tests
```

SIP-Karten, Telefonbücher, Webphone, Experten-Editor und weitere UI-Modelle gehören zur App und liegen daher nicht auf `main`.

## Node.js

Nach dem Klonen:

```bash
npm install
```

Der zentrale Einstieg stellt die öffentlichen Bausteine bereit:

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

Der Paketeinstieg lädt unter Node.js `crypto-js`, `pako`, TweetNaCl und bei Bedarf WebCrypto automatisch.

Ein Export lässt sich beispielsweise so untersuchen:

```powershell
$env:FRITZ_EXPORT_PASSWORD="dein-sicherungskennwort"
node .\examples\node\inspect-export.js C:\Pfad\zur\Sicherung.export
```

Das Beispiel gibt sensible Werte in der Konsole aus. Verwende es nur in einer vertrauenswürdigen lokalen Umgebung.

### Sicherungskennwort ändern

```javascript
const result = await FritzExportEditor.changeExportPassword({
  text: exportText,
  oldPassword: "bisheriges Kennwort",
  newPassword: "neues Kennwort"
});

// Erst nach Master-Key-Roundtrip, Payload-Prüfung und CRC32-Kontrolle vorhanden:
const verifiedExportText = result.updatedText;
```

### Export-Master-Key rotieren

```javascript
const result = await FritzExportEditor.rotateExportMasterKey({
  text: exportText,
  password: "Sicherungskennwort"
  // Ohne newMasterKeyBytes wird crypto.getRandomValues() verwendet.
});
```

## Browserbeispiel

Öffne [examples/browser/index.html](examples/browser/index.html) in einem modernen Browser. Das Beispiel zeigt absichtlich nur:

- Modell und Firmware
- Haupt- und Gast-WLAN
- den maskierten Export-Master-Key
- den geprüften Wechsel des Sicherungskennworts

Die Dateien und Kennwörter verlassen den Browser nicht. Die Beispielseite lädt `pako` und `crypto-js` derzeit von jsDelivr; dafür wird beim Öffnen eine Internetverbindung benötigt.

## Tests

```bash
npm test
```

Die Suite prüft den Paketeinstieg, Secret-Inventar, WireGuard-Keyableitung, CRC32, atomare Exportänderungen und die unterstützten Krypto-Roundtrips.

## Sicherheit

FRITZ!Box-Exporte enthalten unter anderem WLAN-, SIP-, VPN-, Provider- und Benutzerzugangsdaten. Veröffentliche weder unzensierte `.export`-Dateien noch extrahierte `$$$$`-Werte. Die mitgelieferte `.gitignore` blockiert typische Exportdateien.

## Lizenz

Copyright (c) 2026 David Block. Veröffentlicht unter der MIT-Lizenz. Hinweise zu übernommenen Bestandteilen stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Dieses Projekt steht in keiner Verbindung zur AVM GmbH. FRITZ! und FRITZ!Box sind eingetragene Marken der AVM GmbH.
