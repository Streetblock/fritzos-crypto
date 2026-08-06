(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FritzConfigState = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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
    this.fileStatus = "empty";
    this.viewMode = "working";
    this.secrets = [];
  };

  ConfigState.prototype.load = function (text) {
    var normalized = String(text || "");
    this.originalText = normalized;
    this.workingText = normalized;
    this.fileStatus = normalized ? "loaded" : "empty";
    this.viewMode = "working";
    this.syncSecrets(false);
  };

  ConfigState.prototype.setWorkingText = function (text) {
    this.workingText = String(text || "");
    this.fileStatus = this.workingText === this.originalText ? "loaded" : "modified";
    this.viewMode = "working";
    this.syncSecrets(true);
  };

  ConfigState.prototype.syncSecrets = function (preserveResults) {
    var previous = new Map();
    if (preserveResults) {
      this.secrets.forEach(function (secret) {
        previous.set(secret.value, secret);
      });
    }

    this.secrets = this.parser.extractSecrets(this.workingText).map(function (value) {
      var known = previous.get(value);
      return known || {
        value: value,
        status: "pending",
        plaintext: null,
        error: null,
        label: null
      };
    });
  };

  ConfigState.prototype.getSecret = function (value) {
    return this.secrets.find(function (secret) { return secret.value === value; }) || null;
  };

  ConfigState.prototype.markDecrypted = function (value, result) {
    var secret = this.getSecret(value);
    if (!secret) return;
    secret.status = "decrypted";
    secret.plaintext = String(result.plaintext == null ? "" : result.plaintext);
    secret.label = result.label || null;
    secret.error = null;
  };

  ConfigState.prototype.markFailed = function (value, error) {
    var secret = this.getSecret(value);
    if (!secret || secret.status === "decrypted") return;
    secret.status = "failed";
    secret.error = error && error.message ? error.message : String(error || "UNKNOWN_ERROR");
  };

  ConfigState.prototype.getDecryptableSecrets = function () {
    return this.secrets.filter(function (secret) {
      return secret.status === "pending" || secret.status === "failed";
    });
  };

  ConfigState.prototype.getCounts = function () {
    return this.secrets.reduce(function (counts, secret) {
      counts.total += 1;
      counts[secret.status] += 1;
      return counts;
    }, { total: 0, pending: 0, decrypted: 0, failed: 0 });
  };

  ConfigState.prototype.createPreview = function (replaceSecret) {
    var preview = this.workingText;
    this.secrets.forEach(function (secret) {
      if (secret.status === "decrypted" && secret.plaintext !== null) {
        preview = replaceSecret(preview, secret.value, secret.plaintext);
      }
    });
    this.viewMode = "preview";
    return preview;
  };

  ConfigState.prototype.showWorkingCopy = function () {
    this.viewMode = "working";
    return this.workingText;
  };

  return { ConfigState: ConfigState };
});
