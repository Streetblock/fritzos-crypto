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
      this.createLocationLink = settings.createLocationLink || function () { return null; };
      this.isExportMasterKey = settings.isExportMasterKey || function () { return false; };
      this.isWireGuardPrivateKey = settings.isWireGuardPrivateKey || function () { return false; };
      this.confirmEdit = settings.confirmEdit || function () { return true; };
      this.copyPlaintext = settings.copyPlaintext || function () {};
      this.onRender = settings.onRender || function () {};
      this.onChange = settings.onChange || function () {};
      this.createIcons = settings.createIcons || function () {};
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

    render(model) {
      const settings = model || {};
      this.prepare(settings);
      const visibleSecrets = settings.visibleSecrets || [];
      const renderedSecrets = settings.exportMasterKey
        ? [settings.exportMasterKey, ...visibleSecrets]
        : visibleSecrets;
      renderedSecrets.forEach(secret => this.renderRow(secret));
      this.onChange();
      this.createIcons();
    }

    renderRow(secret) {
      const decrypted = secret.status === "decrypted";
      const supported = decrypted && (secret.type === 4 || secret.type === 5);
      const editable = supported && !this.isExportMasterKey(secret);
      const style = this.getStatusStyle(secret);
      const row = this.document.createElement("article");
      row.className = "p-5 grid grid-cols-1 xl:grid-cols-[minmax(210px,0.8fr)_minmax(300px,1.2fr)] gap-4 items-start";
      row.dataset.secretId = secret.id;

      const description = this.document.createElement("div");
      const headingLine = this.document.createElement("div");
      headingLine.className = "flex items-center gap-2 flex-wrap";
      const title = this.document.createElement("h4");
      title.className = "text-sm font-bold text-slate-800";
      title.textContent = secret.displayLabel;
      const categoryBadge = this.document.createElement("span");
      categoryBadge.className = "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600";
      categoryBadge.textContent = this.getCategoryName(secret.category);
      const statusBadge = this.document.createElement("span");
      statusBadge.dataset.secretStatus = "";
      this.updateStatusBadge(statusBadge, style);
      headingLine.append(title, categoryBadge, statusBadge);
      description.appendChild(headingLine);
      const location = this.createLocationLink(secret, "mt-1.5");
      if (location) description.appendChild(location);

      if (secret.validatedChange && secret.editedPlaintext === secret.plaintext) {
        const note = this.document.createElement("p");
        note.className = "text-[11px] font-medium text-emerald-700 mt-1.5";
        const previousLength = secret.previousPlaintext == null ? null : secret.previousPlaintext.length;
        note.textContent = previousLength === null
          ? "Änderung durch Roundtrip und CRC32 validiert"
          : `Validierte Änderung: ${previousLength} → ${secret.plaintext.length} Zeichen`;
        description.appendChild(note);
      }
      if (secret.account) {
        const account = this.document.createElement("p");
        account.className = "text-xs text-slate-600 mt-2 flex items-center gap-1.5";
        const parts = [secret.account.username, secret.account.registrar].filter(Boolean);
        account.textContent = parts.length ? `SIP-Konto: ${parts.join(" · ")}` : secret.account.name;
        description.appendChild(account);
      }

      const valueArea = this.document.createElement("div");
      const input = this.document.createElement("input");
      input.type = this.controller.isRevealed(secret) ? "text" : "password";
      input.value = decrypted ? (secret.editedPlaintext ?? "") : "";
      input.placeholder = style.status === "failed" ? "Entschlüsselung fehlgeschlagen" : "Noch nicht entschlüsselt";
      input.readOnly = true;
      input.disabled = !decrypted;
      input.className = "w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400";
      input.setAttribute("aria-label", `${secret.displayLabel} Klartext`);
      input.dataset.secretValue = "";

      const actions = this.document.createElement("div");
      actions.className = "flex items-center gap-2 flex-wrap mt-2";
      const revealButton = this.createAction(
        this.controller.isRevealed(secret) ? "Verbergen" : "Anzeigen",
        this.controller.isRevealed(secret) ? "eye-off" : "eye",
        () => { this.controller.toggleReveal(secret); this.onRender(); },
        !decrypted
      );
      const copyButton = this.createAction("Kopieren", "copy", () => this.copyPlaintext(secret), !decrypted);
      const editButton = this.createAction("Bearbeiten", "pencil", () => {
        if (!this.confirmEdit(secret)) return;
        this.controller.reveal(secret);
        input.type = "text";
        input.readOnly = false;
        input.focus();
        input.select();
      }, !editable);
      const resetButton = this.createAction("Zurücksetzen", "undo-2", () => {
        this.controller.reset(secret, { render: () => this.onRender() });
      }, false);
      resetButton.dataset.secretReset = "";
      resetButton.classList.toggle("hidden", style.status !== "changed");
      actions.append(revealButton, copyButton, editButton, resetButton);

      input.addEventListener("input", () => {
        this.controller.edit(secret, input.value, { render: () => {
          const currentStyle = this.getStatusStyle(secret);
          this.updateStatusBadge(statusBadge, currentStyle);
          resetButton.classList.toggle("hidden", currentStyle.status !== "changed");
          this.onChange();
          this.createIcons();
        } });
      });
      valueArea.append(input, actions);
      this.appendHint(valueArea, secret, decrypted, supported, style.status);
      row.append(description, valueArea);
      const target = this.isExportMasterKey(secret) ? this.elements.masterCard : this.elements.list;
      target.appendChild(row);
    }

    updateStatusBadge(badge, style) {
      badge.className = `text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.className}`;
      badge.textContent = style.label;
    }

    appendHint(valueArea, secret, decrypted, supported, status) {
      let text = "";
      let className = "text-[11px] mt-2";
      if (decrypted && !supported) {
        text = "Dieser Verschlüsselungstyp kann angezeigt, aber noch nicht neu verschlüsselt werden.";
        className += " text-amber-600";
      } else if (decrypted && this.isExportMasterKey(secret)) {
        text = "Der Export-Master-Key selbst bleibt schreibgeschützt. Geändert wird nur sein Sicherungskennwort.";
        className += " text-blue-700";
      } else if (decrypted && this.isWireGuardPrivateKey(secret)) {
        text = "Der öffentliche FRITZ!Box-Schlüssel wird automatisch neu berechnet. Danach müssen alle WireGuard-Gegenstellen aktualisiert werden.";
        className += " font-medium leading-4 text-amber-700";
      } else if (status === "failed" && secret.error) {
        text = secret.error;
        className += " text-red-600";
      }
      if (!text) return;
      const hint = this.document.createElement("p");
      hint.className = className;
      hint.textContent = text;
      valueArea.appendChild(hint);
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
