(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FritzConfigState = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var API_VERSION = "2";

  function ConfigState(parser) {
    if (!parser || typeof parser.extractSecrets !== "function") {
      throw new Error("A parser with extractSecrets(text) is required");
    }

    this.parser = parser;
    this.reset();
  }

  ConfigState.prototype.reset = function () {
    this.originalText = "";
    this.workingText = "";
    this.savedText = "";
    this.fileStatus = "empty";
    this.viewMode = "working";
    this.secrets = [];
    this.resetVerification();
  };

  ConfigState.prototype.resetVerification = function () {
    this.verification = {
      roundtrip: { status: "idle", message: null },
      checksum: { status: "idle", message: null }
    };
  };

  ConfigState.prototype.setVerificationStep = function (step, status, message) {
    if (!this.verification[step]) throw new Error("Unknown verification step: " + step);
    this.verification[step] = { status: status, message: message || null };
  };

  ConfigState.prototype.invalidateVerification = function () {
    this.resetVerification();
  };

  ConfigState.prototype.load = function (text) {
    var normalized = String(text || "");
    this.originalText = normalized;
    this.workingText = normalized;
    this.savedText = normalized;
    this.fileStatus = normalized ? "loaded" : "empty";
    this.viewMode = "working";
    this.resetVerification();
    this.syncSecrets(false);
  };

  ConfigState.prototype.setWorkingText = function (text) {
    var nextText = String(text || "");
    if (nextText !== this.workingText) this.invalidateVerification();
    this.workingText = nextText;
    this.fileStatus = this.workingText === this.originalText ? "loaded" : "modified";
    this.viewMode = "working";
    this.syncSecrets(true);
  };

  ConfigState.prototype.syncSecrets = function (preserveResults) {
    var previous = new Map();
    if (preserveResults) {
      this.secrets.forEach(function (secret) {
        previous.set(secret.stableKey, secret);
      });
    }

    var inventory;
    if (typeof this.parser.extractSecretInventory === "function") {
      inventory = this.parser.extractSecretInventory(this.workingText);
    } else {
      var searchOffset = 0;
      inventory = this.parser.extractSecrets(this.workingText).map(function (value, index) {
        var start = this.workingText.indexOf(value, searchOffset);
        searchOffset = start + value.length;
        return {
          id: "secret-" + (index + 1),
          stableKey: "legacy|" + (index + 1),
          value: value,
          start: start,
          end: start + value.length,
          section: "Unknown",
          field: "unknown",
          category: "other",
          displayLabel: "Unbekanntes Secret"
        };
      }, this);
    }

    this.secrets = inventory.map(function (item) {
      var known = previous.get(item.stableKey);
      if (known) {
        Object.assign(known, item);
        return known;
      }
      return Object.assign({}, item, {
        status: "pending",
        plaintext: null,
        editedPlaintext: null,
        error: null,
        label: null,
        type: null,
        source: null,
        validatedChange: false,
        previousPlaintext: null
      });
    });
  };

  ConfigState.prototype.getSecret = function (identifier) {
    return this.secrets.find(function (secret) {
      return secret.id === identifier || secret.stableKey === identifier || secret.value === identifier;
    }) || null;
  };

  ConfigState.prototype.markDecrypted = function (identifier, result) {
    var secret = this.getSecret(identifier);
    if (!secret) return;
    secret.status = "decrypted";
    secret.plaintext = String(result.plaintext == null ? "" : result.plaintext);
    secret.editedPlaintext = secret.plaintext;
    secret.label = result.label || null;
    secret.type = result.type || null;
    secret.source = result.source || null;
    secret.error = null;
  };

  ConfigState.prototype.markReencrypted = function (identifier, result, previousPlaintext) {
    this.markDecrypted(identifier, result);
    var secret = this.getSecret(identifier);
    if (!secret) return;
    secret.validatedChange = true;
    secret.previousPlaintext = String(previousPlaintext == null ? "" : previousPlaintext);
  };

  ConfigState.prototype.markFailed = function (identifier, error) {
    var secret = this.getSecret(identifier);
    if (!secret || secret.status === "decrypted") return;
    secret.status = "failed";
    secret.error = error && error.message ? error.message : String(error || "UNKNOWN_ERROR");
  };

  ConfigState.prototype.getDecryptableSecrets = function () {
    return this.secrets.filter(function (secret) {
      return secret.status === "pending" || secret.status === "failed";
    });
  };

  ConfigState.prototype.setEditedPlaintext = function (identifier, plaintext) {
    var secret = this.getSecret(identifier);
    if (!secret || secret.status !== "decrypted") return;
    var nextPlaintext = String(plaintext);
    if (nextPlaintext !== secret.editedPlaintext) this.invalidateVerification();
    secret.editedPlaintext = nextPlaintext;
  };

  ConfigState.prototype.hasUnsavedChanges = function () {
    return this.workingText !== this.savedText || this.getChangedSecrets().length > 0;
  };

  ConfigState.prototype.markDownloaded = function () {
    if (!this.isDownloadReady()) return false;
    this.savedText = this.workingText;
    this.fileStatus = "saved";
    return true;
  };

  ConfigState.prototype.isDownloadReady = function () {
    return Boolean(this.workingText) &&
      this.getChangedSecrets().length === 0 &&
      this.verification.roundtrip.status === "success" &&
      this.verification.checksum.status === "success";
  };

  ConfigState.prototype.restoreOriginal = function () {
    this.workingText = this.originalText;
    this.fileStatus = !this.originalText ? "empty" : this.originalText === this.savedText ? "loaded" : "modified";
    this.viewMode = "working";
    this.resetVerification();
    this.syncSecrets(false);
    return this.workingText;
  };

  ConfigState.prototype.getChangedSecrets = function () {
    return this.secrets.filter(function (secret) {
      return secret.status === "decrypted" &&
        secret.editedPlaintext !== null &&
        secret.editedPlaintext !== secret.plaintext;
    });
  };

  ConfigState.prototype.getModifiedSecrets = function () {
    return this.secrets.filter(function (secret) {
      return secret.status === "decrypted" &&
        (secret.validatedChange ||
          (secret.editedPlaintext !== null && secret.editedPlaintext !== secret.plaintext));
    });
  };

  ConfigState.prototype.getCounts = function () {
    return this.secrets.reduce(function (counts, secret) {
      counts.total += 1;
      counts[secret.status] += 1;
      if (secret.status === "decrypted" &&
        (secret.validatedChange || secret.editedPlaintext !== secret.plaintext)) counts.changed += 1;
      return counts;
    }, { total: 0, pending: 0, decrypted: 0, failed: 0, changed: 0 });
  };

  ConfigState.prototype.createPreview = function (replaceSecret) {
    var preview = this.workingText;
    this.secrets.slice().sort(function (left, right) { return right.start - left.start; }).forEach(function (secret) {
      if (secret.status === "decrypted" && secret.plaintext !== null) {
        preview = replaceSecret(preview, secret, secret.editedPlaintext);
      }
    });
    this.viewMode = "preview";
    return preview;
  };

  ConfigState.prototype.showWorkingCopy = function () {
    this.viewMode = "working";
    return this.workingText;
  };

  return { ConfigState: ConfigState, API_VERSION: API_VERSION };
});
