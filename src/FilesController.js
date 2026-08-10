(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzFilesController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";

  function emptyData() {
    return { files: [], phonebookFiles: [], books: [], errors: [] };
  }

  class FilesController {
    constructor(options) {
      const settings = options || {};
      if (typeof settings.extractPhonebooks !== "function") {
        throw new Error("extractPhonebooks is required");
      }
      this.extractPhonebooks = settings.extractPhonebooks;
      this.data = emptyData();
    }

    load(text) {
      const extracted = this.extractPhonebooks(String(text || "")) || {};
      this.data = {
        files: Array.isArray(extracted.files) ? extracted.files : [],
        phonebookFiles: Array.isArray(extracted.phonebookFiles) ? extracted.phonebookFiles : [],
        books: Array.isArray(extracted.books) ? extracted.books : [],
        errors: Array.isArray(extracted.errors) ? extracted.errors : []
      };
      return this.data;
    }

    reset() {
      this.data = emptyData();
      return this.data;
    }

    getData() {
      return this.data;
    }

    getPhoneContacts() {
      return this.data.books.flatMap(book => (book.contacts || []).flatMap(contact =>
        (contact.numbers || []).filter(number => number.value).map(number => ({
          name: contact.name,
          number: number.value,
          type: number.type,
          book: book.name
        }))
      ));
    }
  }

  return { API_VERSION, FilesController };
});
