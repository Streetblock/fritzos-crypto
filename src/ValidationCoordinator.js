(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzValidationCoordinator = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";

  function selectValidationRequest(snapshot) {
    const state = snapshot || {};
    const changedSecrets = Math.max(0, Number(state.changedSecrets) || 0);
    if (changedSecrets > 0) return { kind: "secrets", changedSecrets };
    if (state.hasUnsavedChanges && !state.downloadReady) return { kind: "working-copy", changedSecrets: 0 };
    return { kind: "none", changedSecrets: 0, verified: Boolean(state.downloadReady) };
  }

  class ValidationCoordinator {
    constructor(options) {
      const settings = options || {};
      if (typeof settings.getSnapshot !== "function") throw new Error("getSnapshot is required");
      if (typeof settings.run !== "function") throw new Error("run is required");

      this.delay = Number.isFinite(settings.delay) ? Math.max(0, settings.delay) : 15000;
      this.getSnapshot = settings.getSnapshot;
      this.hasPassword = typeof settings.hasPassword === "function" ? settings.hasPassword : () => true;
      this.run = settings.run;
      this.onStatus = typeof settings.onStatus === "function" ? settings.onStatus : function () {};
      this.onError = typeof settings.onError === "function" ? settings.onError : function () {};
      this.now = typeof settings.now === "function" ? settings.now : () => Date.now();
      const customSetTimeout = settings.setTimeoutFn;
      const customClearTimeout = settings.clearTimeoutFn;
      const customSetInterval = settings.setIntervalFn;
      const customClearInterval = settings.clearIntervalFn;
      this.setTimeoutFn = customSetTimeout
        ? (...args) => customSetTimeout(...args)
        : (...args) => globalThis.setTimeout(...args);
      this.clearTimeoutFn = customClearTimeout
        ? (...args) => customClearTimeout(...args)
        : (...args) => globalThis.clearTimeout(...args);
      this.setIntervalFn = customSetInterval
        ? (...args) => customSetInterval(...args)
        : (...args) => globalThis.setInterval(...args);
      this.clearIntervalFn = customClearInterval
        ? (...args) => customClearInterval(...args)
        : (...args) => globalThis.clearInterval(...args);

      this.timer = null;
      this.ticker = null;
      this.deadline = 0;
      this.generation = 0;
      this.running = false;
    }

    clearTimers() {
      if (this.timer !== null) this.clearTimeoutFn(this.timer);
      if (this.ticker !== null) this.clearIntervalFn(this.ticker);
      this.timer = null;
      this.ticker = null;
      this.deadline = 0;
    }

    cancel() {
      this.clearTimers();
      this.generation += 1;
      this.running = false;
    }

    isCurrent(generation) {
      return generation === this.generation;
    }

    emit(phase, request, details) {
      this.onStatus(Object.assign({ phase, request, generation: this.generation }, details || {}));
    }

    updateCountdown(request) {
      if (!this.deadline) return;
      const seconds = Math.max(1, Math.ceil((this.deadline - this.now()) / 1000));
      this.emit("waiting", request, { seconds });
    }

    schedule() {
      this.clearTimers();
      this.generation += 1;
      const generation = this.generation;
      const request = selectValidationRequest(this.getSnapshot());

      if (request.kind === "none") {
        this.emit(request.verified ? "verified" : "idle", request);
        return request;
      }
      if (!this.hasPassword()) {
        this.emit("blocked", request);
        return request;
      }

      this.deadline = this.now() + this.delay;
      this.updateCountdown(request);
      this.ticker = this.setIntervalFn(() => this.updateCountdown(request), 1000);
      this.timer = this.setTimeoutFn(() => this.execute(request, generation), this.delay);
      return request;
    }

    async execute(request, generation) {
      this.clearTimers();
      if (!this.isCurrent(generation)) return;
      this.running = true;
      this.emit("running", request);
      try {
        await this.run(request, generation);
      } catch (error) {
        if (this.isCurrent(generation)) this.onError(error, request, generation);
      } finally {
        if (this.isCurrent(generation)) this.running = false;
      }
    }
  }

  return { API_VERSION, ValidationCoordinator, selectValidationRequest };
});
