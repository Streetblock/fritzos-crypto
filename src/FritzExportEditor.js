(function (global, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("../lib/FritzOSCrypto.js"), require("../lib/FritzExportChecksum.js"));
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

    static equalBytes(left, right) {
      if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
      let difference = 0;
      for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
      return difference === 0;
    }

    static verifyMasterKeyPayloads(text, wrappedMasterKey, masterKeyBytes) {
      const inventory = FritzOSCrypto.FritzBoxParser.extractSecretInventory(String(text || ""));
      const payloadSecrets = inventory.filter(secret => secret.value !== wrappedMasterKey);
      for (const secret of payloadSecrets) {
        try {
          FritzOSCrypto.decryptSecretWithKey(secret.value, masterKeyBytes);
        } catch (error) {
          throw new FritzExportEditorError(
            "PASSWORD_BOUND_SECRET_FOUND",
            "roundtrip",
            `Die Fundstelle ${secret.section} · ${secret.field} ist nicht an den Export-Master-Key gebunden`,
            error
          );
        }
      }
      return payloadSecrets.length;
    }

    static async changeExportPassword(options) {
      this.assertDependencies();
      const settings = options || {};
      const originalText = String(settings.text || "");
      const oldPassword = String(settings.oldPassword || "");
      const newPassword = String(settings.newPassword || "");
      const onStep = settings.onStep;
      const assertFresh = typeof settings.assertFresh === "function" ? settings.assertFresh : function () {};
      let activeStage = "roundtrip";

      if (!originalText) throw new FritzExportEditorError("EMPTY_EXPORT", "setup", "Der Export ist leer");
      if (!newPassword) throw new FritzExportEditorError("NEW_PASSWORD_EMPTY", "setup", "Das neue Sicherungskennwort darf nicht leer sein");
      if (oldPassword === newPassword) throw new FritzExportEditorError("PASSWORD_UNCHANGED", "setup", "Das neue Sicherungskennwort ist unverändert");

      const masterMatch = originalText.match(/^Password=(\$\$\$\$[A-Za-z0-9./+=_-]+)/m);
      if (!masterMatch) {
        throw new FritzExportEditorError(
          "MODERN_MASTER_KEY_MISSING",
          "setup",
          "Der Export verwendet keinen unterstützten kennwortgeschützten Export-Master-Key"
        );
      }

      const oldWrappedKey = masterMatch[1];
      const valueStart = masterMatch.index + masterMatch[0].indexOf(oldWrappedKey);
      this.emit(onStep, "roundtrip", "running", "Export-Master-Key wird mit dem neuen Kennwort geschützt");

      try {
        let masterKey;
        try {
          masterKey = FritzOSCrypto.decryptExportKey(oldWrappedKey, oldPassword);
        } catch (error) {
          throw new FritzExportEditorError(
            "OLD_PASSWORD_INVALID",
            "roundtrip",
            "Das bisherige Sicherungskennwort ist falsch",
            error
          );
        }
        assertFresh();

        const payloadSecretsVerified = this.verifyMasterKeyPayloads(
          originalText,
          oldWrappedKey,
          masterKey.aesKeyBytes
        );
        const newWrappedKey = await FritzOSCrypto.encryptExportKey(masterKey.exportKeyBytes, newPassword);
        assertFresh();
        const verification = FritzOSCrypto.decryptExportKey(newWrappedKey, newPassword);
        if (!this.equalBytes(verification.exportKeyBytes, masterKey.exportKeyBytes)) {
          throw new FritzExportEditorError(
            "MASTER_KEY_ROUNDTRIP_MISMATCH",
            "roundtrip",
            "Der Export-Master-Key hat den Kennwort-Roundtrip nicht unverändert überstanden"
          );
        }

        let updatedText = originalText.slice(0, valueStart) + newWrappedKey +
          originalText.slice(valueStart + oldWrappedKey.length);
        this.emit(onStep, "roundtrip", "success", "Export-Master-Key unverändert mit neuem Kennwort geprüft", {
          payloadSecretsVerified
        });

        activeStage = "checksum";
        this.emit(onStep, "checksum", "running", "CRC32 wird aktualisiert und geprüft");
        const checksumResult = FritzExportChecksum.fromText(updatedText).replaceChecksum();
        updatedText = checksumResult.updatedText;
        this.verifyExportChecksum(updatedText);
        assertFresh();
        this.emit(onStep, "checksum", "success", `CRC32 ${checksumResult.newCrc} ist gültig`, checksumResult);

        return {
          updatedText,
          oldWrappedKey,
          newWrappedKey,
          masterKeyBytes: new Uint8Array(masterKey.aesKeyBytes),
          roundtrip: { valid: true, payloadSecretsVerified },
          checksum: { valid: true, oldCrc: checksumResult.oldCrc, newCrc: checksumResult.newCrc }
        };
      } catch (error) {
        if (error && error.message === "PASSWORD_CHANGE_STALE") throw error;
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

    static async verifyWorkingCopy(options) {
      this.assertDependencies();
      const settings = options || {};
      const originalText = String(settings.text || "");
      if (!originalText) throw new FritzExportEditorError("EMPTY_EXPORT", "setup", "Der Export ist leer");
      const password = String(settings.password || "");
      const secrets = (settings.secrets || []).filter(secret =>
        secret.status === "decrypted" && (secret.type === 4 || secret.type === 5)
      );
      const onStep = settings.onStep;
      const assertFresh = typeof settings.assertFresh === "function" ? settings.assertFresh : function () {};
      const masterKeyBytes = this.resolveMasterKey(originalText, password, secrets, settings.masterKeyBytes || null);
      let activeStage = "roundtrip";

      this.emit(onStep, "roundtrip", "running", `${secrets.length} unveränderte Secrets werden geprüft`);
      try {
        for (const secret of secrets) {
          assertFresh();
          const verification = await FritzOSCrypto.AVMCrypto.decryptSecret(
            secret.value,
            password,
            secret.type === 5 ? masterKeyBytes : null
          );
          if (verification.plaintext !== String(secret.plaintext ?? "")) {
            throw new FritzExportEditorError(
              "SOURCE_SECRET_MISMATCH",
              "roundtrip",
              `Verschlüsselter Wert für ${secret.id || secret.stableKey || "Secret"} stimmt nicht mehr überein`
            );
          }
        }
        assertFresh();
        this.emit(onStep, "roundtrip", "success", `${secrets.length} Secrets unverändert und lesbar`, { count: secrets.length });

        activeStage = "checksum";
        this.emit(onStep, "checksum", "running", "CRC32 wird aktualisiert und geprüft");
        const checksumResult = FritzExportChecksum.fromText(originalText).replaceChecksum();
        this.verifyExportChecksum(checksumResult.updatedText);
        assertFresh();
        this.emit(onStep, "checksum", "success", `CRC32 ${checksumResult.newCrc} ist gültig`, checksumResult);
        return {
          updatedText: checksumResult.updatedText,
          roundtrip: { valid: true, count: secrets.length },
          checksum: { valid: true, oldCrc: checksumResult.oldCrc, newCrc: checksumResult.newCrc }
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
