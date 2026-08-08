(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FritzEmbeddedFiles = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var API_VERSION = "1";

  function decodeBase64(value) {
    var clean = String(value || "").trim();
    if (!clean) return new Uint8Array(0);
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(clean, "base64"));
    var binary = atob(clean);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function concatBytes(chunks) {
    var length = chunks.reduce(function (total, chunk) { return total + chunk.length; }, 0);
    var result = new Uint8Array(length);
    var offset = 0;
    chunks.forEach(function (chunk) {
      result.set(chunk, offset);
      offset += chunk.length;
    });
    return result;
  }

  function decodeUtf8(bytes) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decodeURIComponent(escape(String.fromCharCode.apply(null, Array.from(bytes))));
  }

  function decodeXmlEntities(value) {
    return String(value == null ? "" : value).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (_, entity) {
      var normalized = entity.toLowerCase();
      if (normalized === "amp") return "&";
      if (normalized === "lt") return "<";
      if (normalized === "gt") return ">";
      if (normalized === "quot") return '"';
      if (normalized === "apos") return "'";
      var codePoint = normalized.indexOf("#x") === 0
        ? parseInt(normalized.slice(2), 16)
        : parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    });
  }

  function parseAttributes(source) {
    var attributes = Object.create(null);
    String(source || "").replace(/([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, function (_, name, doubleQuoted, singleQuoted) {
      attributes[name] = decodeXmlEntities(doubleQuoted == null ? singleQuoted : doubleQuoted);
      return _;
    });
    return attributes;
  }

  function extractTagText(source, tagName) {
    var pattern = new RegExp("<" + tagName + "\\b[^>]*>([\\s\\S]*?)<\\/" + tagName + ">", "i");
    var match = String(source || "").match(pattern);
    if (!match) return "";
    return decodeXmlEntities(match[1].replace(/<[^>]+>/g, "").trim());
  }

  function extractB64Files(text) {
    var lines = String(text || "").split(/\r\n|\n|\r/);
    var files = [];
    var active = null;
    lines.forEach(function (line, index) {
      var marker = line.match(/^\*+\s+((?:CRYPTED)?B64FILE):\s*([^\s]+).*$/i);
      if (marker) {
        active = { type: marker[1].toUpperCase(), name: marker[2], line: index + 1, payloadLines: [] };
        return;
      }
      if (!active) return;
      if (/^\*+\s+END OF FILE\s+\*+/i.test(line)) {
        var chunks = active.payloadLines.filter(Boolean).map(decodeBase64);
        files.push({
          type: active.type,
          name: active.name,
          line: active.line,
          payloadLines: active.payloadLines.slice(),
          bytes: concatBytes(chunks)
        });
        active = null;
        return;
      }
      var payload = line.trim();
      if (payload) active.payloadLines.push(payload);
    });
    return files;
  }

  function parsePhonebookXml(xml, source) {
    var books = [];
    var phonebookPattern = /<phonebook\b([^>]*)>([\s\S]*?)<\/phonebook>/gi;
    var phonebookMatch;
    while ((phonebookMatch = phonebookPattern.exec(String(xml || ""))) !== null) {
      var attributes = parseAttributes(phonebookMatch[1]);
      var contacts = [];
      var contactPattern = /<contact\b[^>]*>([\s\S]*?)<\/contact>/gi;
      var contactMatch;
      while ((contactMatch = contactPattern.exec(phonebookMatch[2])) !== null) {
        var contactXml = contactMatch[1];
        var numbers = [];
        var numberPattern = /<number\b([^>]*)>([\s\S]*?)<\/number>/gi;
        var numberMatch;
        while ((numberMatch = numberPattern.exec(contactXml)) !== null) {
          var numberAttributes = parseAttributes(numberMatch[1]);
          numbers.push({
            value: decodeXmlEntities(numberMatch[2].replace(/<[^>]+>/g, "").trim()),
            type: numberAttributes.type || "other",
            id: numberAttributes.id || null,
            priority: numberAttributes.prio || null,
            vanity: numberAttributes.vanity || ""
          });
        }
        contacts.push({
          name: extractTagText(contactXml, "realName") || "Unbenannter Kontakt",
          category: extractTagText(contactXml, "category"),
          uniqueId: extractTagText(contactXml, "uniqueid") || null,
          modifiedAt: extractTagText(contactXml, "mod_time") || null,
          numbers: numbers
        });
      }
      var owner = attributes.owner || null;
      books.push({
        id: (source && source.name ? source.name : "phonebook") + "|" + books.length,
        name: attributes.name || (owner === "255" ? "Interne Ziele" : "Telefonbuch"),
        owner: owner,
        sourceName: source && source.name ? source.name : "phonebook",
        sourceLine: source && source.line ? source.line : null,
        contacts: contacts
      });
    }
    return books;
  }

  function extractPhonebooks(text) {
    var files = extractB64Files(text);
    var phonebookFiles = files.filter(function (file) { return file.name.toLowerCase() === "phonebook"; });
    var books = [];
    var errors = [];
    phonebookFiles.forEach(function (file) {
      try {
        var xml = decodeUtf8(file.bytes);
        if (!/<phonebook\b/i.test(xml)) throw new Error("Kein unterstütztes Telefonbuch-XML");
        books.push.apply(books, parsePhonebookXml(xml, file));
      } catch (error) {
        errors.push({ name: file.name, line: file.line, message: error.message || String(error) });
      }
    });
    return { files: files, phonebookFiles: phonebookFiles, books: books, errors: errors };
  }

  return {
    API_VERSION: API_VERSION,
    decodeBase64: decodeBase64,
    decodeUtf8: decodeUtf8,
    extractB64Files: extractB64Files,
    parsePhonebookXml: parsePhonebookXml,
    extractPhonebooks: extractPhonebooks
  };
});
