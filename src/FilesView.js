(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzFilesView = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";
  const NUMBER_LABELS = {
    home: "Privat", mobile: "Mobil", work: "Arbeit", intern: "Intern",
    memo: "Memo", fax: "Fax", fax_home: "Fax privat", fax_work: "Fax Arbeit",
    other: "Weitere"
  };

  class FilesView {
    constructor(options) {
      const settings = options || {};
      if (typeof settings.createFilePreview !== "function") throw new Error("createFilePreview is required");
      this.elements = settings.elements || {};
      this.document = settings.document || root.document;
      this.createFilePreview = settings.createFilePreview;
      this.humanizeField = settings.humanizeField || (value => String(value || ""));
      this.onJumpToLine = settings.onJumpToLine || function () {};
      this.createIcons = settings.createIcons || function () {};
    }

    getPhoneNumberTypeLabel(type) {
      return NUMBER_LABELS[String(type || "").toLowerCase()] || this.humanizeField(type || "Weitere");
    }

    formatByteSize(bytes) {
      const value = Number(bytes) || 0;
      if (value < 1024) return `${value} Bytes`;
      if (value < 1024 * 1024) return `${(value / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} KB`;
      return `${(value / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
    }

    createSourceButton(line, label) {
      const button = this.document.createElement("button");
      button.type = "button";
      button.className = "text-xs font-medium text-slate-500 hover:text-blue-700 hover:underline";
      button.textContent = label || `Zeile ${line}`;
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        this.onJumpToLine(line);
      });
      return button;
    }

    render(data, queryValue) {
      const model = data || { files: [], phonebookFiles: [], books: [], errors: [] };
      this.renderEmbeddedFiles(model);
      this.renderPhonebooks(model, queryValue);
      this.createIcons();
    }

    renderEmbeddedFiles(data) {
      const plainFiles = data.files.filter(file => file.type === "B64FILE");
      const additionalFiles = plainFiles.filter(file => file.name.toLowerCase() !== "phonebook");
      this.elements.navCount.textContent = plainFiles.length;
      this.elements.embeddedSection.classList.toggle("hidden", additionalFiles.length === 0);
      this.elements.embeddedSummary.textContent = `${additionalFiles.length} ${additionalFiles.length === 1 ? "Datei" : "Dateien"} · Base64 dekodiert · Nur ansehen`;
      this.elements.embedded.innerHTML = "";

      additionalFiles.forEach(file => {
        const preview = this.createFilePreview(file);
        const details = this.document.createElement("details");
        details.className = "group rounded-xl border border-slate-200 overflow-hidden";
        const summary = this.document.createElement("summary");
        summary.className = "cursor-pointer list-none bg-slate-50 px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-100";
        const identity = this.document.createElement("div");
        identity.className = "min-w-0 flex items-center gap-3";
        const icon = this.document.createElement("span");
        icon.className = "w-9 h-9 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center";
        icon.innerHTML = '<i data-lucide="file" class="w-4 h-4"></i>';
        const text = this.document.createElement("div");
        text.className = "min-w-0";
        const title = this.document.createElement("h4");
        title.className = "font-semibold text-slate-900 truncate";
        title.textContent = file.name;
        const meta = this.document.createElement("p");
        meta.className = "text-xs text-slate-500 mt-0.5";
        meta.textContent = `${this.formatByteSize(file.bytes.length)} · ${preview.kind === "text" ? "Text" : "Binärdaten"}`;
        text.append(title, meta);
        identity.append(icon, text);
        const actions = this.document.createElement("div");
        actions.className = "flex items-center gap-3 shrink-0";
        const chevron = this.document.createElement("i");
        chevron.setAttribute("data-lucide", "chevron-down");
        chevron.className = "w-4 h-4 text-slate-400 transition-transform group-open:rotate-180";
        actions.append(this.createSourceButton(file.line), chevron);
        summary.append(identity, actions);

        const content = this.document.createElement("div");
        content.className = "border-t border-slate-200 bg-slate-950";
        if (preview.kind === "binary") {
          const note = this.document.createElement("p");
          note.className = "px-4 pt-3 text-xs text-amber-300";
          note.textContent = "Binärdatei · Hex-Vorschau der Base64-dekodierten Bytes";
          content.appendChild(note);
        }
        const pre = this.document.createElement("pre");
        pre.className = "m-0 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5 text-slate-200";
        pre.textContent = preview.content || "(Datei ist leer)";
        content.appendChild(pre);
        if (preview.truncated) {
          const note = this.document.createElement("p");
          note.className = "border-t border-slate-800 px-4 py-2 text-xs text-amber-300";
          note.textContent = "Vorschau gekürzt.";
          content.appendChild(note);
        }
        details.append(summary, content);
        this.elements.embedded.appendChild(details);
      });
    }

    renderPhonebooks(data, queryValue) {
      const query = String(queryValue || "").trim().toLocaleLowerCase("de");
      const totalContacts = data.books.reduce((sum, book) => sum + book.contacts.length, 0);
      const visibleBooks = data.books.map(book => ({
        book,
        contacts: book.contacts.filter(contact => {
          if (!query) return true;
          return [contact.name, contact.category, ...contact.numbers.flatMap(number =>
            [number.value, number.type, this.getPhoneNumberTypeLabel(number.type)]
          )].filter(Boolean).join(" ").toLocaleLowerCase("de").includes(query);
        })
      })).filter(entry => entry.contacts.length > 0 || (!query && entry.book.contacts.length === 0));
      const visibleContacts = visibleBooks.reduce((sum, entry) => sum + entry.contacts.length, 0);
      const hasPhonebookFile = data.phonebookFiles.length > 0;

      this.elements.overviewCard.classList.toggle("hidden", !hasPhonebookFile);
      this.elements.overviewSummary.textContent = `${data.books.length} ${data.books.length === 1 ? "Telefonbuch" : "Telefonbücher"} · ${totalContacts} ${totalContacts === 1 ? "Kontakt" : "Kontakte"}`;
      this.elements.phonebookSection.classList.toggle("hidden", !hasPhonebookFile);
      this.elements.emptyState.classList.toggle("hidden", !data.files.some(file => file.type === "B64FILE"));
      this.elements.phonebookSummary.textContent = query
        ? `${visibleContacts} von ${totalContacts} Kontakten in ${data.books.length} Telefonbüchern`
        : `${data.books.length} Telefonbücher · ${totalContacts} Kontakte`;
      this.elements.errors.classList.toggle("hidden", data.errors.length === 0);
      this.elements.errors.textContent = data.errors.length ? `${data.errors.length} Telefonbuchdatei konnte nicht gelesen werden.` : "";
      this.elements.phonebooks.innerHTML = "";
      this.elements.xml.innerHTML = "";
      this.elements.xml.classList.toggle("hidden", data.phonebookFiles.length === 0);

      if (visibleBooks.length === 0 && hasPhonebookFile) {
        const empty = this.document.createElement("div");
        empty.className = "rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500";
        empty.textContent = query ? "Kein Kontakt passt zur Suche." : "Die Telefonbuchdatei enthält keine lesbaren Kontakte.";
        this.elements.phonebooks.appendChild(empty);
      }

      visibleBooks.forEach((entry, bookIndex) => this.renderPhonebook(entry, bookIndex, Boolean(query)));
      data.phonebookFiles.forEach(file => this.renderXmlFile(file));
    }

    renderPhonebook(entry, bookIndex, hasQuery) {
      const details = this.document.createElement("details");
      details.className = "group rounded-2xl border border-slate-200 overflow-hidden";
      details.open = hasQuery || bookIndex === 0;
      const summary = this.document.createElement("summary");
      summary.className = "cursor-pointer list-none bg-slate-50 px-4 py-3 flex items-center justify-between gap-4";
      const heading = this.document.createElement("div");
      heading.className = "min-w-0";
      const title = this.document.createElement("h4");
      title.className = "font-bold text-slate-900 truncate";
      title.textContent = entry.book.name;
      const meta = this.document.createElement("p");
      meta.className = "text-xs text-slate-500 mt-0.5";
      meta.textContent = `${entry.contacts.length}${hasQuery ? ` von ${entry.book.contacts.length}` : ""} Kontakte${entry.book.owner === "255" ? " · FRITZ!Box-interne Ziele" : ""}`;
      heading.append(title, meta);
      const actions = this.document.createElement("div");
      actions.className = "flex items-center gap-3 shrink-0";
      if (entry.book.sourceLine) actions.appendChild(this.createSourceButton(entry.book.sourceLine, `${entry.book.sourceName} · Zeile ${entry.book.sourceLine}`));
      const chevron = this.document.createElement("i");
      chevron.setAttribute("data-lucide", "chevron-down");
      chevron.className = "w-4 h-4 text-slate-400 transition-transform group-open:rotate-180";
      actions.appendChild(chevron);
      summary.append(heading, actions);

      const contacts = this.document.createElement("div");
      contacts.className = "grid grid-cols-1 xl:grid-cols-2 gap-3 p-4 bg-white";
      entry.contacts.forEach(contact => contacts.appendChild(this.renderContact(contact)));
      details.append(summary, contacts);
      this.elements.phonebooks.appendChild(details);
    }

    renderContact(contact) {
      const card = this.document.createElement("article");
      card.className = "rounded-xl border border-slate-200 p-4 min-w-0";
      const header = this.document.createElement("div");
      header.className = "flex items-center gap-3";
      const avatar = this.document.createElement("span");
      avatar.className = "w-9 h-9 shrink-0 rounded-full bg-cyan-50 text-cyan-700 flex items-center justify-center text-sm font-bold";
      avatar.textContent = contact.name.trim().slice(0, 1).toLocaleUpperCase("de") || "?";
      const identity = this.document.createElement("div");
      identity.className = "min-w-0";
      const name = this.document.createElement("h5");
      name.className = "font-semibold text-slate-900 truncate";
      name.textContent = contact.name;
      identity.appendChild(name);
      if (contact.category) {
        const category = this.document.createElement("p");
        category.className = "text-[11px] text-slate-500 mt-0.5";
        category.textContent = contact.category;
        identity.appendChild(category);
      }
      header.append(avatar, identity);
      card.appendChild(header);
      const numbers = this.document.createElement("div");
      numbers.className = "mt-3 space-y-2";
      if (contact.numbers.length === 0) {
        const empty = this.document.createElement("p");
        empty.className = "text-xs text-slate-400";
        empty.textContent = "Keine Rufnummer hinterlegt";
        numbers.appendChild(empty);
      }
      contact.numbers.forEach(number => {
        const row = this.document.createElement("div");
        row.className = "flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2";
        const value = this.document.createElement("span");
        value.className = "font-mono text-sm text-slate-800 break-all";
        value.textContent = number.value || "—";
        const type = this.document.createElement("span");
        type.className = "shrink-0 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500";
        type.textContent = this.getPhoneNumberTypeLabel(number.type);
        row.append(value, type);
        numbers.appendChild(row);
      });
      card.appendChild(numbers);
      return card;
    }

    renderXmlFile(file) {
      const preview = this.createFilePreview(file);
      const details = this.document.createElement("details");
      details.className = "group rounded-xl border border-slate-200 overflow-hidden";
      const summary = this.document.createElement("summary");
      summary.className = "cursor-pointer list-none bg-slate-50 px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-100";
      const label = this.document.createElement("span");
      label.className = "flex items-center gap-2 text-sm font-semibold text-slate-700";
      label.innerHTML = '<i data-lucide="braces" class="w-4 h-4 text-cyan-600"></i>';
      const labelText = this.document.createElement("span");
      labelText.textContent = `Dekodierte XML-Quelldatei anzeigen · ${this.formatByteSize(file.bytes.length)}`;
      label.appendChild(labelText);
      const actions = this.document.createElement("span");
      actions.className = "flex items-center gap-3 shrink-0";
      actions.appendChild(this.createSourceButton(file.line));
      const chevron = this.document.createElement("i");
      chevron.setAttribute("data-lucide", "chevron-down");
      chevron.className = "w-4 h-4 text-slate-400 transition-transform group-open:rotate-180";
      actions.appendChild(chevron);
      summary.append(label, actions);
      const xml = this.document.createElement("pre");
      xml.className = "m-0 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-200";
      xml.textContent = preview.content || "(Datei ist leer)";
      details.append(summary, xml);
      this.elements.xml.appendChild(details);
    }
  }

  return { API_VERSION, FilesView };
});
