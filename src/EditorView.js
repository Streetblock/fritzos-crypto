(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzEditorView = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";

  class EditorView {
    constructor(options) {
      const settings = options || {};
      this.elements = settings.elements || {};
      this.document = settings.document || root.document;
      this.getComputedStyle = settings.getComputedStyle || root.getComputedStyle;
      this.requestFrame = settings.requestFrame || root.requestAnimationFrame;
      this.onJumpRequest = settings.onJumpRequest || function () {};
    }

    updateTextMetrics() {
      const text = String(this.elements.editor.value || "");
      this.elements.charCount.textContent = `${text.length.toLocaleString("de-DE")} Zeichen`;
      this.renderNavigation(text);
    }

    syncScroll() {
      if (this.elements.lineNumbers) this.elements.lineNumbers.scrollTop = this.elements.editor.scrollTop;
    }

    getSections(text) {
      const sections = [];
      String(text || "").split(/\r\n|\n|\r/).forEach((line, index) => {
        const match = line.match(/^\*+\s+(CFGFILE|(?:CRYPTED)?BINFILE|(?:CRYPTED)?B64FILE):\s*(\S+)/i);
        if (match) sections.push({ type: match[1].toUpperCase(), name: match[2], line: index + 1 });
      });
      return sections;
    }

    renderNavigation(text) {
      if (!this.elements.lineNumbers || !this.elements.sectionNav) return;
      const lineCount = Math.max(1, String(text || "").split(/\r\n|\n|\r/).length);
      this.elements.lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
      this.syncScroll();
      this.elements.sectionNav.innerHTML = "";
      const targets = [{ type: "HEADER", name: "Dateianfang", line: 1 }, ...this.getSections(text)];
      targets.forEach(section => {
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700";
        button.textContent = `${section.name} · Z. ${section.line}`;
        button.title = section.type === "HEADER" ? "Zum Anfang der Exportdatei" : `${section.type} ab Zeile ${section.line}`;
        button.addEventListener("click", () => this.onJumpRequest(section.line));
        this.elements.sectionNav.appendChild(button);
      });
    }

    getLineRange(lineNumber) {
      const text = String(this.elements.editor.value || "");
      const target = Math.max(1, Number(lineNumber) || 1);
      let line = 1;
      let start = 0;
      const separator = /\r\n|\n|\r/g;
      let match;
      while (line < target && (match = separator.exec(text))) {
        start = match.index + match[0].length;
        line += 1;
      }
      const relativeEnd = text.slice(start).search(/\r\n|\n|\r/);
      return { start, end: relativeEnd >= 0 ? start + relativeEnd : text.length, line };
    }

    focusLine(lineNumber) {
      this.requestFrame(() => {
        const range = this.getLineRange(lineNumber);
        const lineHeight = parseFloat(this.getComputedStyle(this.elements.editor).lineHeight) || 24;
        this.elements.editor.focus({ preventScroll: true });
        this.elements.editor.setSelectionRange(range.start, range.end);
        this.elements.editor.scrollTop = Math.max(0, (range.line - 1) * lineHeight - this.elements.editor.clientHeight * 0.25);
        this.syncScroll();
      });
    }

    applyTheme(viewMode, theme) {
      const consoleTheme = viewMode === "preview" && theme === "console";
      const toggle = (element, name, enabled) => element.classList.toggle(name, enabled);
      toggle(this.elements.editor, "bg-slate-900", consoleTheme);
      toggle(this.elements.editor, "text-green-400", consoleTheme);
      toggle(this.elements.editor, "bg-slate-50", !consoleTheme);
      toggle(this.elements.editor, "text-slate-700", !consoleTheme);
      toggle(this.elements.lineNumbers, "bg-slate-950", consoleTheme);
      toggle(this.elements.lineNumbers, "text-green-700", consoleTheme);
      toggle(this.elements.lineNumbers, "border-slate-700", consoleTheme);
      toggle(this.elements.lineNumbers, "bg-slate-100", !consoleTheme);
      toggle(this.elements.lineNumbers, "text-slate-400", !consoleTheme);
      toggle(this.elements.lineNumbers, "border-slate-200", !consoleTheme);
      toggle(this.elements.shell, "bg-slate-900", consoleTheme);
      toggle(this.elements.shell, "border-slate-700", consoleTheme);
      toggle(this.elements.shell, "bg-slate-50", !consoleTheme);
      toggle(this.elements.shell, "border-slate-300", !consoleTheme);
      this.elements.themeButton.innerHTML = consoleTheme
        ? '<i data-lucide="panel-top" class="w-4 h-4"></i> Editor-Look'
        : '<i data-lucide="terminal" class="w-4 h-4"></i> Konsolen-Look';
    }
  }

  return { API_VERSION, EditorView };
});
