(function (global, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./FritzOSCrypto.js"), require("./FritzExportChecksum.js"));
  } else {
    global.FritzExportEditor = factory(global.FritzOSCrypto, global.FritzExportChecksum);
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function (FritzOSCrypto, FritzExportChecksum) {
  "use strict";

  var API_VERSION = "1";

  class FritzExportEditorError extends Error {
    constructor(code, stage, message, cause) {
      super(message || code);
      this.name = "FritzExportEditorError";
      this.code = code;
      this.stage = stage;
      this.cause = cause || null;
    }
  }

  class FritzExportEditor {
    static emit(callback, step, status, message, details) {
      if (typeof callback === "function") {
        callback({ step, status, message, details: details || null });
      }
    }

    static assertDependencies() {
      if (!FritzOSCrypto || !FritzOSCrypto.AVMCrypto || !FritzExportChecksum) {
        throw new FritzExportEditorError(
          "DEPENDENCY_MISSING",
          "setup",
          "FritzOSCrypto und FritzExportChecksum werden benötigt"
        );
      }
    }

    static resolveMasterKey(text, password, changes, providedMasterKey) {
      if (!changes.some(change => change.type === 5)) return null;
      if (providedMasterKey) return providedMasterKey;
      const masterMatch = String(text).match(/^Password=(\$\$\$\$[A-Za-z0-9./+=_-]+)/m);
      if (!masterMatch) {
        throw new FritzExportEditorError(
          "MASTER_KEY_MISSING",
          "roundtrip",
          "Der Datei-Master-Key wurde nicht gefunden"
        );
      }
      try {
        return FritzOSCrypto.decryptExportKey(masterMatch[1], password).aesKeyBytes;
      } catch (error) {
        throw new FritzExportEditorError(
          "MASTER_KEY_DECRYPT_FAILED",
          "roundtrip",
          "Der Datei-Master-Key konnte nicht entschlüsselt werden",
          error
        );
      }
    }

    static validateChanges(text, changes) {
      if (!String(text || "")) {
        throw new FritzExportEditorError("EMPTY_EXPORT", "setup", "Der Export ist leer");
      }
      if (!Array.isArray(changes) || changes.length === 0) {
        throw new FritzExportEditorError("NO_CHANGES", "setup", "Es wurden keine Änderungen übergeben");
      }
      return changes.map(change => {
        if (change.type !== 4 && change.type !== 5) {
          throw new FritzExportEditorError(
            "UNSUPPORTED_SECRET_TYPE",
            "setup",
            `Secret ${change.id || change.stableKey || "?"} hat einen nicht unterstützten Typ`
          );
        }
        if (!Number.isInteger(change.start) || !Number.isInteger(change.end) || change.end <= change.start) {
          throw new FritzExportEditorError("INVALID_SECRET_RANGE", "setup", "Eine Secret-Fundstelle ist ungültig");
        }
        return Object.assign({}, change, { editedPlaintext: String(change.editedPlaintext ?? "") });
      });
    }

    static verifyExportChecksum(text) {
      this.assertDependencies();
      const result = FritzExportChecksum.fromText(String(text || "")).calculate();
      if (result.oldCrc !== result.newCrc) {
        throw new FritzExportEditorError(
          "CHECKSUM_ROUNDTRIP_MISMATCH",
          "checksum",
          "Die CRC32 des Exports ist ungültig"
        );
      }
      return { valid: true, oldCrc: result.oldCrc, newCrc: result.newCrc };
    }

    static async applySecretChanges(options) {
      this.assertDependencies();
      const settings = options || {};
      const originalText = String(settings.text || "");
      const changes = this.validateChanges(originalText, settings.changes);
      const password = String(settings.password || "");
      const onStep = settings.onStep;
      const assertFresh = typeof settings.assertFresh === "function" ? settings.assertFresh : function () {};
      const masterKeyBytes = this.resolveMasterKey(
        originalText,
        password,
        changes,
        settings.masterKeyBytes || null
      );
      const replacements = [];
      let activeStage = "roundtrip";

      this.emit(onStep, "roundtrip", "running", `${changes.length} Secrets werden neu verschlüsselt und geprüft`);
      try {
        for (const change of changes) {
          assertFresh();
          const sourceVerification = await FritzOSCrypto.AVMCrypto.decryptSecret(
            change.value,
            password,
            change.type === 5 ? masterKeyBytes : null
          );
          assertFresh();
          if (sourceVerification.plaintext !== String(change.plaintext ?? "")) {
            throw new FritzExportEditorError(
              "SOURCE_SECRET_MISMATCH",
              "roundtrip",
              `Ausgangswert für ${change.id || change.stableKey || "Secret"} stimmt nicht überein`
            );
          }
          const newValue = change.type === 5
            ? await FritzOSCrypto.encryptSecretWithKey(change.editedPlaintext, masterKeyBytes)
            : await FritzOSCrypto.AVMCrypto.encryptSecret(change.editedPlaintext, password);
          assertFresh();
          const verification = await FritzOSCrypto.AVMCrypto.decryptSecret(
            newValue,
            password,
            change.type === 5 ? masterKeyBytes : null
          );
          assertFresh();
          if (verification.plaintext !== change.editedPlaintext) {
            throw new FritzExportEditorError(
              "ROUNDTRIP_MISMATCH",
              "roundtrip",
              `Roundtrip für ${change.id || change.stableKey || "Secret"} stimmt nicht überein`
            );
          }
          replacements.push({
            id: change.id,
            stableKey: change.stableKey,
            previousPlaintext: change.plaintext,
            oldValue: change.value,
            newValue,
            start: change.start,
            end: change.end,
            verification
          });
        }

        this.emit(onStep, "roundtrip", "success", `${replacements.length} Secrets erfolgreich zurückentschlüsselt`, {
          count: replacements.length
        });

        let updatedText = originalText;
        replacements
          .slice()
          .sort((left, right) => right.start - left.start)
          .forEach(replacement => {
            if (updatedText.slice(replacement.start, replacement.end) !== replacement.oldValue) {
              throw new FritzExportEditorError(
                "SECRET_POSITION_MISMATCH",
                "roundtrip",
                "Eine Secret-Fundstelle hat sich während der Bearbeitung verschoben"
              );
            }
            updatedText = updatedText.slice(0, replacement.start) +
              replacement.newValue + updatedText.slice(replacement.end);
          });
        assertFresh();

        activeStage = "checksum";
        this.emit(onStep, "checksum", "running", "CRC32 wird aktualisiert und geprüft");
        const checksumResult = FritzExportChecksum.fromText(updatedText).replaceChecksum();
        this.verifyExportChecksum(checksumResult.updatedText);
        assertFresh();
        this.emit(onStep, "checksum", "success", `CRC32 ${checksumResult.newCrc} ist gültig`, checksumResult);

        return {
          updatedText: checksumResult.updatedText,
          replacements,
          roundtrip: { valid: true, count: replacements.length },
          checksum: {
            valid: true,
            oldCrc: checksumResult.oldCrc,
            newCrc: checksumResult.newCrc
          }
        };
      } catch (error) {
        if (error && error.message === "AUTO_VALIDATION_STALE") throw error;
        const wrapped = error instanceof FritzExportEditorError
          ? error
          : new FritzExportEditorError(
            activeStage === "checksum" ? "CHECKSUM_FAILED" : "ROUNDTRIP_FAILED",
            activeStage,
            error && error.message ? error.message : String(error),
            error
          );
        this.emit(onStep, wrapped.stage || activeStage, "failed", wrapped.message, { code: wrapped.code });
        throw wrapped;
      }
    }
  }

  return {
    API_VERSION,
    FritzExportEditor,
    FritzExportEditorError
  };
});
