(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzEditorController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";

  class EditorController {
    constructor(options) {
      const settings = options || {};
      if (!settings.state) throw new Error("state is required");
      if (!settings.editor) throw new Error("editor is required");
      if (typeof settings.decryptedEditor?.applyEdit !== "function" ||
          typeof settings.decryptedEditor?.buildDocument !== "function") {
        throw new Error("decryptedEditor is required");
      }
      if (typeof settings.commitMutation !== "function") throw new Error("commitMutation is required");
      if (typeof settings.replaceSecret !== "function") throw new Error("replaceSecret is required");

      this.state = settings.state;
      this.editor = settings.editor;
      this.decryptedEditor = settings.decryptedEditor;
      this.commitMutation = settings.commitMutation;
      this.replaceSecret = settings.replaceSecret;
      this.onStatus = typeof settings.onStatus === "function" ? settings.onStatus : function () {};
      this.onTextRendered = typeof settings.onTextRendered === "function" ? settings.onTextRendered : function () {};
      this.model = null;
    }

    handleInput() {
      if (this.state.viewMode !== "preview") {
        this.commitMutation({ kind: "structure", workingText: this.editor.value });
        return;
      }

      const selection = this.editor.selectionStart;
      let edit;
      try {
        edit = this.decryptedEditor.applyEdit(this.model, this.editor.value, this.state.workingText);
      } catch (error) {
        this.onStatus(`Änderung nicht übernommen: ${error.message}`, "warning");
        this.renderPreviewText(selection);
        return;
      }
      if (edit.kind === "conflict") {
        this.onStatus(`${edit.message} Bitte Secret und Struktur nacheinander bearbeiten.`, "warning");
        this.renderPreviewText(selection);
        return;
      }
      this.commitMutation(edit, { selection });
    }

    renderPreviewText(selection = null) {
      this.state.createPreview((text, secret, plaintext) => this.replaceSecret(text, secret, plaintext));
      this.model = this.decryptedEditor.buildDocument(this.state.workingText, this.state.secrets);
      this.editor.value = this.model.text;
      this.onTextRendered();
      if (selection !== null) this.editor.setSelectionRange(selection, selection);
      return this.model;
    }

    clearModel() {
      this.model = null;
    }
  }

  return { API_VERSION, EditorController };
});
