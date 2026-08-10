(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzSecretView = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";
  const CATEGORY_NAMES = {
    wlan: "WLAN", "guest-wlan": "Gast-WLAN", sip: "SIP",
    "internal-telephony": "Interne Nebenstelle", "online-phonebook": "Online-Telefonbuch",
    telephony: "Weitere Telefonie", vpn: "VPN", "fritz-user": "FRITZ!Box-Benutzer",
    "app-access": "FRITZ!App", email: "E-Mail / SMTP", myfritz: "MyFRITZ!",
    dyndns: "Eigener DynDNS-Anbieter", "remote-management": "AVM-Fernkonfiguration",
    "avm-remote-ddns": "AVM-Fernkonfig-DDNS", provider: "Provider", system: "System",
    other: "Weitere"
  };
  const STATUS_STYLES = {
    pending: ["Offen", "bg-blue-50 text-blue-700 border-blue-200"],
    decrypted: ["Entschlüsselt", "bg-emerald-50 text-emerald-700 border-emerald-200"],
    changed: ["Geändert", "bg-amber-50 text-amber-700 border-amber-200"],
    failed: ["Fehlgeschlagen", "bg-red-50 text-red-700 border-red-200"]
  };

  class SecretView {
    constructor(options) {
      const settings = options || {};
      if (!settings.controller) throw new Error("controller is required");
      this.controller = settings.controller;
      this.elements = settings.elements || {};
      this.document = settings.document || root.document;
    }

    getCategoryName(category) {
      return CATEGORY_NAMES[category] || CATEGORY_NAMES.other;
    }

    getStatusStyle(secret) {
      const status = this.controller.getDisplayStatus(secret);
      const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
      return {
        status,
        label: this.controller.getStatusLabel(secret) || style[0],
        className: style[1]
      };
    }

    createAction(label, icon, handler, disabled) {
      const button = this.document.createElement("button");
      button.type = "button";
      button.disabled = Boolean(disabled);
      button.className = "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed";
      button.innerHTML = `<i data-lucide="${icon}" class="w-3.5 h-3.5"></i><span>${label}</span>`;
      if (handler) button.addEventListener("click", handler);
      return button;
    }

    prepare(model) {
      const settings = model || {};
      const allSecrets = settings.allSecrets || [];
      const regularSecrets = settings.regularSecrets || [];
      const visibleSecrets = settings.visibleSecrets || [];
      const exportMasterKey = settings.exportMasterKey || null;
      this.elements.list.innerHTML = "";
      this.elements.masterCard.innerHTML = "";
      this.elements.masterSection.classList.toggle("hidden", !exportMasterKey);
      this.elements.editorSection.classList.toggle("hidden", regularSecrets.length === 0);
      this.elements.emptyState.classList.toggle("hidden", allSecrets.length > 0);
      this.elements.resultsSummary.textContent = `${visibleSecrets.length} von ${regularSecrets.length} Fundstellen angezeigt`;
      const decrypted = allSecrets.filter(secret => secret.status === "decrypted");
      const allRevealed = decrypted.length > 0 && decrypted.every(secret => this.controller.isRevealed(secret));
      this.elements.toggleAll.disabled = decrypted.length === 0;
      this.elements.toggleAll.innerHTML = allRevealed
        ? '<i data-lucide="eye-off" class="w-4 h-4"></i> Alle verbergen'
        : '<i data-lucide="eye" class="w-4 h-4"></i> Alle anzeigen';
      if (visibleSecrets.length === 0 && regularSecrets.length > 0) {
        const noResults = this.document.createElement("div");
        noResults.className = "p-10 text-center text-sm text-slate-500";
        noResults.textContent = "Keine Fundstelle passt zu Suche und Filtern.";
        this.elements.list.appendChild(noResults);
      }
    }

    syncRow(secret) {
      const containers = [this.elements.list, this.elements.masterCard].filter(Boolean);
      const row = containers.flatMap(container => [...container.querySelectorAll("[data-secret-id]")])
        .find(candidate => candidate.dataset.secretId === secret.id);
      if (!row) return;
      const input = row.querySelector("[data-secret-value]");
      const statusBadge = row.querySelector("[data-secret-status]");
      const resetButton = row.querySelector("[data-secret-reset]");
      const style = this.getStatusStyle(secret);
      if (input && this.document.activeElement !== input) {
        input.value = secret.status === "decrypted" ? (secret.editedPlaintext ?? "") : "";
        input.type = this.controller.isRevealed(secret) ? "text" : "password";
      }
      if (statusBadge) {
        statusBadge.className = `text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.className}`;
        statusBadge.textContent = style.label;
      }
      resetButton?.classList.toggle("hidden", style.status !== "changed");
    }
  }

  return { API_VERSION, SecretView };
});
