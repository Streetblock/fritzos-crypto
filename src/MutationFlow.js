(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzMutationFlow = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";

  function commitMutation(state, mutation) {
    if (!state) throw new Error("state is required");
    const change = mutation || {};
    const keepPreviewVisible = state.viewMode === "preview";

    if (change.kind === "secret") {
      if (!change.secretId) throw new Error("secretId is required");
      state.setEditedPlaintext(change.secretId, change.plaintext);
    } else if (change.kind === "structure") {
      state.setWorkingText(change.workingText);
    } else {
      throw new Error("Unknown config mutation: " + change.kind);
    }

    return { kind: change.kind, keepPreviewVisible };
  }

  return { API_VERSION, commitMutation };
});
