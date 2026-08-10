(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzTelephonyController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";
  const REGISTERED_STATES = ["registered", "calling", "active"];
  const BUSY_STATES = ["connecting", "calling", "active"];

  class TelephonyController {
    constructor(options) {
      const settings = options || {};
      if (!settings.phone) throw new Error("phone is required");
      this.phone = settings.phone;
      this.mediaDevices = settings.mediaDevices || null;
      this.reset();
    }

    reset() {
      this.accounts = [];
      this.phoneState = "idle";
      this.selectedContact = null;
    }

    setAccounts(accounts) {
      this.accounts = Array.isArray(accounts) ? accounts : [];
      return this.accounts;
    }

    getAccounts() {
      return this.accounts;
    }

    getAccount(accountId) {
      return this.accounts.find(account => account.id === accountId) || null;
    }

    setPhoneState(state) {
      this.phoneState = state || "idle";
      return this.phoneState;
    }

    getPhoneState() {
      return this.phoneState;
    }

    isRegistered() {
      return REGISTERED_STATES.includes(this.phoneState);
    }

    isBusy() {
      return BUSY_STATES.includes(this.phoneState);
    }

    selectContact(contact) {
      this.selectedContact = contact || null;
      return this.selectedContact;
    }

    clearSelectedContact() {
      this.selectedContact = null;
    }

    async disconnect() {
      await this.phone.disconnect();
    }

    async toggleConnection(account) {
      if (this.isRegistered()) {
        await this.disconnect();
        return "disconnected";
      }
      if (!account) return "missing-account";
      await this.phone.connect(account);
      return "connected";
    }

    async requestMicrophone() {
      if (!this.mediaDevices?.getUserMedia) {
        throw new Error("Mikrofonzugriff wird von diesem Browser nicht unterstützt.");
      }
      const stream = await this.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach(track => track.stop());
    }

    async call(target) {
      await this.requestMicrophone();
      await this.phone.call(target);
    }

    async answer() {
      await this.requestMicrophone();
      await this.phone.answer();
    }

    async hangup() {
      await this.phone.hangup();
    }

    normalizePhoneNumber(value) {
      return String(value || "").replace(/[^0-9+]/g, "").replace(/^00/, "+");
    }

    findContact(contacts, number) {
      const target = this.normalizePhoneNumber(number);
      if (!target) return null;
      return (contacts || []).find(contact => {
        const candidate = this.normalizePhoneNumber(contact.number);
        return candidate === target ||
          (candidate.length >= 7 && target.endsWith(candidate.slice(-7))) ||
          (target.length >= 7 && candidate.endsWith(target.slice(-7)));
      }) || null;
    }
  }

  return { API_VERSION, TelephonyController };
});
