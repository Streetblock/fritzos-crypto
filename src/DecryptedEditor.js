(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzDecryptedEditor = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function encodePlaintext(text, secret, plaintext) {
    const previous = text[secret.start - 1];
    const next = text[secret.end];
    const value = String(plaintext == null ? "" : plaintext);
    if (previous === '"' && next === '"') {
      return { text: value.replace(/\\/g, "\\\\").replace(/"/g, '\\"'), quote: "double" };
    }
    if (previous === "'" && next === "'") {
      return { text: value.replace(/\\/g, "\\\\").replace(/'/g, "\\'"), quote: "single" };
    }
    return { text: `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`, quote: "added" };
  }

  function decodePlaintext(value, quote) {
    let source = String(value);
    if (quote === "added") {
      if (source.length < 2 || source[0] !== '"' || source[source.length - 1] !== '"') {
        throw new Error("Die automatisch ergänzten Anführungszeichen dürfen nicht entfernt werden.");
      }
      source = source.slice(1, -1);
    }
    let result = "";
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] === "\\" && index + 1 < source.length &&
          ["\\", quote === "single" ? "'" : '"'].includes(source[index + 1])) {
        result += source[index + 1];
        index += 1;
      } else {
        result += source[index];
      }
    }
    return result;
  }

  function buildDocument(workingText, secrets) {
    const source = String(workingText || "");
    const ordered = (secrets || []).filter(secret => secret.status === "decrypted" && secret.plaintext !== null)
      .slice().sort((left, right) => left.start - right.start);
    let text = "";
    let cursor = 0;
    const mappings = [];
    for (const secret of ordered) {
      if (secret.start < cursor || source.slice(secret.start, secret.end) !== secret.value) continue;
      text += source.slice(cursor, secret.start);
      const encoded = encodePlaintext(source, secret, secret.editedPlaintext);
      const start = text.length;
      text += encoded.text;
      mappings.push({
        id: secret.id,
        stableKey: secret.stableKey,
        start,
        end: text.length,
        encryptedStart: secret.start,
        encryptedEnd: secret.end,
        quote: encoded.quote,
        editable: secret.type === 4 || secret.type === 5
      });
      cursor = secret.end;
    }
    text += source.slice(cursor);
    return { text, mappings };
  }

  function findDiff(previousText, nextText) {
    let start = 0;
    const maxPrefix = Math.min(previousText.length, nextText.length);
    while (start < maxPrefix && previousText[start] === nextText[start]) start += 1;
    let previousEnd = previousText.length;
    let nextEnd = nextText.length;
    while (previousEnd > start && nextEnd > start &&
      previousText[previousEnd - 1] === nextText[nextEnd - 1]) {
      previousEnd -= 1;
      nextEnd -= 1;
    }
    return { start, previousEnd, inserted: nextText.slice(start, nextEnd) };
  }

  function touchesMapping(diff, mapping) {
    if (diff.start === diff.previousEnd) return diff.start >= mapping.start && diff.start <= mapping.end;
    return diff.start < mapping.end && diff.previousEnd > mapping.start;
  }

  function toEncryptedOffset(offset, mappings) {
    let result = offset;
    for (const mapping of mappings) {
      if (mapping.end <= offset) {
        result += (mapping.encryptedEnd - mapping.encryptedStart) - (mapping.end - mapping.start);
      }
    }
    return result;
  }

  function applyEdit(model, nextText, workingText) {
    const previousText = String(model?.text || "");
    const next = String(nextText || "");
    if (previousText === next) return { kind: "none" };
    const diff = findDiff(previousText, next);
    const touched = (model.mappings || []).filter(mapping => touchesMapping(diff, mapping));

    if (touched.length === 1 && diff.start >= touched[0].start && diff.previousEnd <= touched[0].end) {
      const mapping = touched[0];
      if (!mapping.editable) {
        return { kind: "conflict", message: "Dieses entschlüsselte Systemfeld kann hier nicht sicher neu verschlüsselt werden." };
      }
      const current = previousText.slice(mapping.start, mapping.end);
      const localStart = diff.start - mapping.start;
      const localEnd = diff.previousEnd - mapping.start;
      const visible = current.slice(0, localStart) + diff.inserted + current.slice(localEnd);
      return { kind: "secret", secretId: mapping.id, plaintext: decodePlaintext(visible, mapping.quote) };
    }
    if (touched.length > 0) {
      return { kind: "conflict", message: "Eine Änderung darf nicht gleichzeitig Secret und Konfigurationsstruktur überdecken." };
    }

    const encryptedStart = toEncryptedOffset(diff.start, model.mappings || []);
    const encryptedEnd = toEncryptedOffset(diff.previousEnd, model.mappings || []);
    return {
      kind: "structure",
      workingText: String(workingText || "").slice(0, encryptedStart) + diff.inserted +
        String(workingText || "").slice(encryptedEnd)
    };
  }

  return { buildDocument, applyEdit, encodePlaintext, decodePlaintext };
});
