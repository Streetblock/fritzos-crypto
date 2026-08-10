(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzSecretController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";

  class SecretController {
    constructor(options) {
      const settings = options || {};
      if (typeof settings.commitMutation !== "function") throw new Error("commitMutation is required");
      this.commitMutation = settings.commitMutation;
      this.revealed = new Set();
    }

    getDisplayStatus(secret) {
      if (secret.status === "decrypted" &&
          (secret.validatedChange || secret.editedPlaintext !== secret.plaintext)) return "changed";
      return secret.status;
    }

    getStatusLabel(secret) {
      if (secret.status === "decrypted" && secret.editedPlaintext !== secret.plaintext) return "Geändert";
      if (secret.validatedChange) return "Geändert · validiert";
      return null;
    }

    isRevealed(secret) {
      return this.revealed.has(secret.stableKey);
    }

    reveal(secret) {
      this.revealed.add(secret.stableKey);
    }

    toggleReveal(secret) {
      if (this.isRevealed(secret)) this.revealed.delete(secret.stableKey);
      else this.reveal(secret);
      return this.isRevealed(secret);
    }

    clearRevealed() {
      this.revealed.clear();
    }

    toggleAll(secrets) {
      const decrypted = (secrets || []).filter(secret => secret.status === "decrypted");
      const allRevealed = decrypted.length > 0 && decrypted.every(secret => this.isRevealed(secret));
      decrypted.forEach(secret => {
        if (allRevealed) this.revealed.delete(secret.stableKey);
        else this.reveal(secret);
      });
      return !allRevealed;
    }

    filter(secrets, options) {
      const settings = options || {};
      const query = String(settings.query || "").trim().toLocaleLowerCase("de");
      const category = settings.category || "all";
      const status = settings.status || "all";
      const getSearchText = typeof settings.getSearchText === "function"
        ? settings.getSearchText
        : secret => String(secret.displayLabel || "").toLocaleLowerCase("de");
      return (secrets || []).filter(secret =>
        (!query || getSearchText(secret).includes(query)) &&
        (category === "all" || secret.category === category) &&
        (status === "all" || this.getDisplayStatus(secret) === status)
      );
    }

    edit(secret, plaintext, options) {
      return this.commitMutation(
        { kind: "secret", secretId: secret.id, plaintext },
        options || {}
      );
    }

    reset(secret, options) {
      return this.edit(secret, secret.plaintext, options);
    }
  }

  return { API_VERSION, SecretController };
});
