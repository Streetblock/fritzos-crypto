/**
 * FritzOSCrypto.test.js
 * * Saubere Test-Suite für die FritzOSCrypto.js Bibliothek.
 * * Voraussetzung (Node.js Umgebung):
 * npm install pako crypto-js
 * * Ausführung:
 * node test/fritzoscrypto.test.js
 */

// 1. Polyfills für Node.js bereitstellen
// Simuliert die Browser-Umgebung für WebCrypto, Pako und CryptoJS
const crypto = require('crypto');
if (typeof globalThis.crypto === 'undefined') {
    // Node.js v15+ stellt WebCrypto unter crypto.webcrypto bereit
    globalThis.crypto = crypto.webcrypto;
}
globalThis.pako = require('pako');
globalThis.CryptoJS = require('crypto-js');

// 2. Zu testendes Modul laden (Pfad angepasst für Aufruf aus "test/" Unterordner)
const FritzOSCrypto = require('../FritzOSCrypto.js');
const { AVMCrypto, FritzBoxParser } = FritzOSCrypto;

// 3. Test-Runner
async function runAllTests() {
    console.log("==================================================");
    console.log("🚀 Starte FritzOSCrypto.js Test-Suite");
    console.log("==================================================\n");

    let passed = 0;
    let failed = 0;

    // Hilfsfunktion für saubere Assertions
    const assert = (condition, message) => {
        if (!condition) {
            console.error(`  ❌ FEHLER: ${message}`);
            throw new Error(message); 
        }
    };

    const testPassword = "MySuperSecretRouterPassword123!";
    const testPlaintext = "Dies ist ein geheimes VoIP-Passwort oder so ähnlich.";
    let encryptedTyp4 = "";

    // --- TEST 1: Verschlüsselung (Typ 4) ---
    try {
        console.log("▶ TEST 1: Verschlüsseln als AVM Typ 4 (AES-GCM)");
        encryptedTyp4 = await AVMCrypto.encryptSecret(testPlaintext, testPassword);
        
        assert(encryptedTyp4.startsWith("$$$$"), "Verschlüsselter String muss mit $$$$ beginnen");
        assert(encryptedTyp4.length > 20, "Verschlüsselter String ist zu kurz");
        
        console.log(`  ✅ OK (Ergebnis: ${encryptedTyp4.substring(0, 30)}...)`);
        passed++;
    } catch (e) {
        console.error("  ❌ Exception:", e.message);
        failed++;
    }

    // --- TEST 2: Entschlüsselung (Typ 4) ---
    try {
        console.log("\n▶ TEST 2: Entschlüsseln des generierten Typ 4 Strings");
        const decrypted = await AVMCrypto.decryptSecret(encryptedTyp4, testPassword);
        
        assert(decrypted.plaintext === testPlaintext, "Klartext stimmt nicht überein");
        assert(decrypted.type === 4, "Sollte als Typ 4 erkannt werden");
        
        console.log(`  ✅ OK (Klartext korrekt wiederhergestellt)`);
        passed++;
    } catch (e) {
        console.error("  ❌ Exception:", e.message);
        failed++;
    }

    // --- TEST 3: Parser (Export-Header Erkennung) ---
    try {
        console.log("\n▶ TEST 3: FritzBoxParser - Header-Erkennung");
        const dummyConfig = `**** FRITZ!Box 7590 CONFIGURATION EXPORT
Password=${encryptedTyp4}
FirmwareVersion=154.07.57
**** CFGFILE:ar7.cfg
/* EOF */`;
        
        const isExport = FritzBoxParser.isExportFile(dummyConfig);
        assert(isExport, "Export-Datei wurde nicht als solche erkannt");
        
        const meta = FritzBoxParser.parseHeader(dummyConfig);
        assert(meta['Modell'] === "7590", "Modell wurde nicht korrekt geparst");
        assert(meta['FirmwareVersion'] === "154.07.57", "FirmwareVersion wurde nicht korrekt geparst");
        
        console.log(`  ✅ OK (Header und Metadaten korrekt geparst)`);
        passed++;
    } catch (e) {
        console.error("  ❌ Exception:", e.message);
        failed++;
    }

    // --- TEST 4: Parser (Secret-Extraktion) ---
    try {
        console.log("\n▶ TEST 4: FritzBoxParser - Geheimnis-Extraktion");
        const dummyConfig2 = `
        test1=$$$$1234567890ABCDEF
        test2=$$$$ABCDEFGHIJKLMNOPQR
        test3=$$$$1234567890ABCDEF
        `;
        
        const secrets = FritzBoxParser.extractSecrets(dummyConfig2);
        assert(secrets.length === 2, "Es sollten genau 2 (eindeutige) Secrets gefunden werden (Duplikate ignorieren)");
        assert(secrets.includes("$$$$1234567890ABCDEF"), "Secret 1 fehlt");
        assert(secrets.includes("$$$$ABCDEFGHIJKLMNOPQR"), "Secret 2 fehlt");
        
        console.log(`  ✅ OK (${secrets.length} eindeutige Secrets extrahiert)`);
        passed++;
    } catch (e) {
        console.error("  ❌ Exception:", e.message);
        failed++;
    }

    // --- TEST 5: Fallback & Fehlerbehandlung ---
    try {
        console.log("\n▶ TEST 5: Fehlerbehandlung (Falsches Passwort)");
        let errorCaught = false;
        try {
            await AVMCrypto.decryptSecret(encryptedTyp4, "FalschesPasswort!");
        } catch (err) {
            errorCaught = true;
            assert(err.message === "BAD_PASSWORD" || err.message.includes("wrong password"), "Sollte einen BAD_PASSWORD Fehler werfen");
        }
        
        assert(errorCaught, "Es wurde kein Fehler bei falschem Passwort geworfen");
        
        console.log(`  ✅ OK (Fehler wurde wie erwartet abgefangen)`);
        passed++;
    } catch (e) {
        console.error("  ❌ Exception:", e.message);
        failed++;
    }

    // --- TEST 6: Moderne feldweise Master-Key-Verschlüsselung ---
    try {
        console.log("\n▶ TEST 6: Typ-5-Secret mit Master-Key neu verschlüsseln");
        const masterKey = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
        const changedPlaintext = 'Neues WLAN-Passwort; mit Umlaut ä und "Zitat"';
        const encryptedWithKey = await FritzOSCrypto.encryptSecretWithKey(changedPlaintext, masterKey);
        const decryptedWithKey = FritzOSCrypto.decryptSecretWithKey(encryptedWithKey, masterKey);

        assert(encryptedWithKey.startsWith('$$$$'), 'Typ-5-Secret muss mit $$$$ beginnen');
        assert(decryptedWithKey.text === changedPlaintext, 'Master-Key-Roundtrip muss den geänderten Text erhalten');

        console.log('  ✅ OK (feldweiser Master-Key-Roundtrip erfolgreich)');
        passed++;
    } catch (e) {
        console.error('  ❌ Exception:', e.message);
        failed++;
    }

    // --- TEST 7: Export-Master-Key mit neuem Kennwort verpacken ---
    try {
        console.log("\n▶ TEST 7: Export-Master-Key mit neuem Kennwort verpacken");
        const exportKey = Uint8Array.from({ length: 16 }, (_, index) => index + 17);
        const generatedExportKey = FritzOSCrypto.generateExportKey();
        assert(generatedExportKey instanceof Uint8Array, 'Zufälliger Export-Master-Key muss binär vorliegen');
        assert(generatedExportKey.length === 16, 'Zufälliger Export-Master-Key muss exakt 16 Byte enthalten');
        const wrappedExportKey = await FritzOSCrypto.encryptExportKey(exportKey, 'neues-sicherungskennwort');
        const unwrappedExportKey = FritzOSCrypto.decryptExportKey(wrappedExportKey, 'neues-sicherungskennwort');

        assert(
            FritzOSCrypto.toHex(unwrappedExportKey.exportKeyBytes) === FritzOSCrypto.toHex(exportKey),
            'Der Export-Master-Key muss beim Kennwortwechsel bytegenau erhalten bleiben'
        );
        let wrongExportPasswordRejected = false;
        try {
            FritzOSCrypto.decryptExportKey(wrappedExportKey, 'falsches-kennwort');
        } catch (_) {
            wrongExportPasswordRejected = true;
        }
        assert(wrongExportPasswordRejected, 'Ein falsches Kennwort darf die neue Hülle nicht öffnen');

        console.log('  ✅ OK (Export-Master-Key unverändert neu verpackt)');
        passed++;
    } catch (e) {
        console.error('  ❌ Exception:', e.message);
        failed++;
    }

    // --- Zusammenfassung ---
    console.log("\n==================================================");
    if (failed === 0) {
        console.log(`🎉 ALLE TESTS BESTANDEN (${passed}/${passed + failed})`);
    } else {
        console.log(`⚠️ FEHLSCHLAG: ${failed} Tests fehlgeschlagen, ${passed} erfolgreich.`);
        process.exitCode = 1; // Setzt den Exit-Code für CI-Pipelines (z.B. GitHub Actions) auf Fehler
    }
    console.log("==================================================\n");
}

// Tests starten
runAllTests();
