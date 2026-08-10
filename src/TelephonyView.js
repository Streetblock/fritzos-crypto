(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzTelephonyView = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";
  const STATE_STYLES = {
    idle: ["Nicht verbunden", "bg-slate-400", "text-slate-600"],
    connecting: ["Verbindung wird aufgebaut…", "bg-amber-500", "text-amber-700"],
    registered: ["Mit Sipgate verbunden", "bg-emerald-500", "text-emerald-700"],
    calling: ["Anruf wird aufgebaut…", "bg-amber-500", "text-amber-700"],
    active: ["Gespräch aktiv", "bg-emerald-500", "text-emerald-700"],
    failed: ["Verbindung fehlgeschlagen", "bg-red-500", "text-red-700"]
  };

  class TelephonyView {
    constructor(options) {
      const settings = options || {};
      this.elements = settings.elements || {};
      this.document = settings.document || root.document;
      this.createIcons = settings.createIcons || function () {};
    }

    getSelectedAccountId() {
      return this.elements.account?.value || "";
    }

    setSelectedAccountId(accountId) {
      if (this.elements.account) this.elements.account.value = accountId || "";
    }

    renderAccounts(accounts, notice) {
      const items = accounts || [];
      const selectedId = this.getSelectedAccountId();
      this.elements.navCount.textContent = items.length;
      this.elements.account.innerHTML = "";
      if (items.length === 0) {
        const option = this.document.createElement("option");
        option.value = "";
        option.textContent = "Kein kompatibles entschlüsseltes Konto";
        this.elements.account.appendChild(option);
      } else {
        items.forEach(account => {
          const option = this.document.createElement("option");
          option.value = account.id;
          option.textContent = `${account.providerName} · ${account.username}@${account.registrar}`;
          this.elements.account.appendChild(option);
        });
        if (items.some(account => account.id === selectedId)) this.setSelectedAccountId(selectedId);
      }
      this.elements.notice.textContent = notice;
    }

    renderAccountPreview(account, busy) {
      this.elements.websocket.textContent = account?.websocket || "—";
      this.elements.connect.disabled = !account || busy;
    }

    renderState(model) {
      const state = model.phoneState || "idle";
      const [label, dotClass, textClass] = STATE_STYLES[state] || STATE_STYLES.idle;
      this.elements.status.className = `inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold ${textClass}`;
      this.elements.status.innerHTML = `<span class="w-2 h-2 rounded-full ${dotClass}"></span> ${label}`;
      this.elements.connect.disabled = (!model.hasAccount && !model.registered) || model.busy;
      this.elements.connect.innerHTML = model.registered
        ? '<i data-lucide="unplug" class="w-4 h-4"></i> Verbindung trennen'
        : '<i data-lucide="plug" class="w-4 h-4"></i> Mit Sipgate verbinden';
      this.elements.account.disabled = state !== "idle" && state !== "failed";
      this.elements.call.disabled = state !== "registered";
      this.elements.hangup.disabled = !["calling", "active"].includes(state);
      this.createIcons();
    }

    handleStateEvent(event) {
      if (event.state !== "calling") this.elements.incoming.classList.add("hidden");
      if (event.detail) this.elements.message.textContent = event.detail;
    }

    showIncoming(label) {
      this.elements.incomingCaller.textContent = label;
      this.elements.incoming.classList.remove("hidden");
    }

    hideIncoming() {
      this.elements.incoming.classList.add("hidden");
    }

    setMessage(message) {
      this.elements.message.textContent = message;
    }

    clearSelectedContact() {
      this.elements.selectedContact.textContent = "";
    }

    showSelectedContact(contact) {
      this.elements.dialTarget.value = contact.number;
      this.elements.selectedContact.textContent = `${contact.name} · ${contact.book}`;
      this.elements.dialTarget.focus();
    }
  }

  return { API_VERSION, TelephonyView };
});
