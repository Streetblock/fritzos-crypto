(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FritzConfigDocument = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_VERSION = "1";

  function lineStarts(text) {
    const starts = [0];
    const pattern = /\r\n|\n|\r/g;
    let match;
    while ((match = pattern.exec(text))) starts.push(match.index + match[0].length);
    return starts;
  }

  function lineAt(starts, offset) {
    let low = 0;
    let high = starts.length;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if (starts[middle] <= offset) low = middle;
      else high = middle;
    }
    return low + 1;
  }

  function tokenize(text, start, end) {
    const tokens = [];
    let index = start;
    while (index < end) {
      const char = text[index];
      if (/\s/.test(char)) {
        const tokenStart = index++;
        while (index < end && /\s/.test(text[index])) index += 1;
        tokens.push({ type: "trivia", start: tokenStart, end: index });
        continue;
      }
      if (char === "/" && text[index + 1] === "*") {
        const tokenStart = index;
        index += 2;
        while (index < end && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
        index = Math.min(end, index + 2);
        tokens.push({ type: "trivia", start: tokenStart, end: index });
        continue;
      }
      if (char === "/" && text[index + 1] === "/") {
        const tokenStart = index;
        index += 2;
        while (index < end && !/[\r\n]/.test(text[index])) index += 1;
        tokens.push({ type: "trivia", start: tokenStart, end: index });
        continue;
      }
      if (char === '"' || char === "'") {
        const quote = char;
        const tokenStart = index++;
        while (index < end) {
          if (text[index] === "\\") index += Math.min(2, end - index);
          else if (text[index++] === quote) break;
        }
        tokens.push({ type: "string", quote, start: tokenStart, end: index });
        continue;
      }
      if (/[A-Za-z_]/.test(char)) {
        const tokenStart = index++;
        while (index < end && /[A-Za-z0-9_-]/.test(text[index])) index += 1;
        tokens.push({ type: "identifier", start: tokenStart, end: index, value: text.slice(tokenStart, index) });
        continue;
      }
      const punctuation = "{}=;,".includes(char);
      tokens.push({ type: punctuation ? char : "raw", start: index, end: index + 1, value: char });
      index += 1;
    }
    return tokens;
  }

  function nextSignificant(tokens, index) {
    while (index < tokens.length && tokens[index].type === "trivia") index += 1;
    return index;
  }

  function decodeValue(raw, quote) {
    if (!quote) return raw.trim();
    const body = raw.slice(1, -1);
    let result = "";
    for (let index = 0; index < body.length; index += 1) {
      if (body[index] === "\\" && index + 1 < body.length) result += body[++index];
      else result += body[index];
    }
    return result;
  }

  function encodeValue(value, quote) {
    const source = String(value == null ? "" : value);
    if (!quote) return source;
    const escaped = source.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), `\\${quote}`);
    return `${quote}${escaped}${quote}`;
  }

  class ConfigDocument {
    constructor(source) {
      this.source = String(source || "");
      this.lineStarts = lineStarts(this.source);
      this.sections = [];
      this.nodes = new Map();
      this.parseSections();
    }

    parseSections() {
      const marker = /^\*+\s+(CFGFILE|(?:CRYPTED)?BINFILE|(?:CRYPTED)?B64FILE):\s*([^\s]+).*$/gmi;
      const matches = [...this.source.matchAll(marker)];
      matches.forEach((match, index) => {
        const markerStart = match.index;
        const markerEnd = markerStart + match[0].length;
        const nextStart = matches[index + 1]?.index ?? this.source.length;
        const endMatch = /^\*+\s+END OF FILE.*$/gmi;
        endMatch.lastIndex = markerEnd;
        const candidate = endMatch.exec(this.source);
        const contentEnd = candidate && candidate.index < nextStart ? candidate.index : nextStart;
        const sectionEnd = candidate && candidate.index < nextStart ? candidate.index + candidate[0].length : nextStart;
        const section = {
          type: "section",
          id: `section-${this.sections.length + 1}`,
          kind: match[1].toUpperCase(),
          name: match[2],
          markerStart,
          markerEnd,
          contentStart: markerEnd,
          contentEnd,
          end: sectionEnd,
          line: lineAt(this.lineStarts, markerStart),
          children: []
        };
        this.sections.push(section);
        this.nodes.set(section.id, section);
        if (section.kind === "CFGFILE") this.parseConfigSection(section);
      });
    }

    parseConfigSection(section) {
      const tokens = tokenize(this.source, section.contentStart, section.contentEnd);
      const stack = [section];
      let index = 0;
      let nodeCounter = 0;
      while ((index = nextSignificant(tokens, index)) < tokens.length) {
        const token = tokens[index];
        if (token.type === "}") {
          let closedBlock = null;
          if (stack.length > 1) {
            closedBlock = stack.pop();
            closedBlock.closeStart = token.start;
            closedBlock.closeEnd = token.end;
            closedBlock.end = token.end;
          }
          const siblingIndex = nextSignificant(tokens, index + 1);
          if (closedBlock && tokens[siblingIndex]?.type === "{") {
            const parent = closedBlock.parent;
            const sibling = {
              type: "block",
              id: `${section.id}-block-${++nodeCounter}`,
              name: closedBlock.name,
              anonymous: true,
              start: tokens[siblingIndex].start,
              nameStart: null,
              nameEnd: null,
              openStart: tokens[siblingIndex].start,
              openEnd: tokens[siblingIndex].end,
              closeStart: null,
              closeEnd: null,
              end: section.contentEnd,
              line: lineAt(this.lineStarts, tokens[siblingIndex].start),
              parent,
              children: []
            };
            parent.children.push(sibling);
            this.nodes.set(sibling.id, sibling);
            stack.push(sibling);
            index = siblingIndex + 1;
            continue;
          }
          index += 1;
          continue;
        }
        if (token.type !== "identifier") {
          index += 1;
          continue;
        }
        const nextIndex = nextSignificant(tokens, index + 1);
        const next = tokens[nextIndex];
        if (next?.type === "=") {
          let valueIndex = nextSignificant(tokens, nextIndex + 1);
          const valueStart = tokens[valueIndex]?.start ?? next.end;
          let cursor = valueIndex;
          while (cursor < tokens.length && ![";", ",", "}"].includes(tokens[cursor].type)) cursor += 1;
          const terminator = tokens[cursor];
          const valueEnd = terminator ? terminator.start : section.contentEnd;
          const rawValue = this.source.slice(valueStart, valueEnd).trimEnd();
          const trimmedEnd = valueStart + rawValue.length;
          const quote = rawValue[0] === '"' || rawValue[0] === "'" ? rawValue[0] : null;
          const assignment = {
            type: "assignment",
            id: `${section.id}-assignment-${++nodeCounter}`,
            name: token.value,
            start: token.start,
            end: [";", ","].includes(terminator?.type) ? terminator.end : trimmedEnd,
            valueStart,
            valueEnd: trimmedEnd,
            rawValue,
            value: decodeValue(rawValue, quote),
            quote,
            line: lineAt(this.lineStarts, token.start),
            parent: stack[stack.length - 1]
          };
          assignment.parent.children.push(assignment);
          this.nodes.set(assignment.id, assignment);
          index = [";", ","].includes(terminator?.type) ? cursor + 1 : cursor;
          continue;
        }

        let cursor = nextIndex;
        while (cursor < tokens.length && !["{", "=", ";", ",", "}"].includes(tokens[cursor].type)) cursor += 1;
        if (tokens[cursor]?.type === "{") {
          const parent = stack[stack.length - 1];
          const block = {
            type: "block",
            id: `${section.id}-block-${++nodeCounter}`,
            name: token.value,
            start: token.start,
            nameStart: token.start,
            nameEnd: token.end,
            openStart: tokens[cursor].start,
            openEnd: tokens[cursor].end,
            closeStart: null,
            closeEnd: null,
            end: section.contentEnd,
            line: lineAt(this.lineStarts, token.start),
            parent,
            children: []
          };
          parent.children.push(block);
          this.nodes.set(block.id, block);
          stack.push(block);
          index = cursor + 1;
          continue;
        }
        index += 1;
      }
    }

    getSection(name) {
      const normalized = String(name || "").toLowerCase();
      return this.sections.find(section => section.name.toLowerCase() === normalized) || null;
    }

    getBlocks(sectionOrBlock, predicate = () => true) {
      const result = [];
      const visit = node => {
        for (const child of node?.children || []) {
          if (child.type === "block") {
            if (predicate(child)) result.push(child);
            visit(child);
          }
        }
      };
      visit(sectionOrBlock);
      return result;
    }

    getAssignments(block) {
      return (block?.children || []).filter(child => child.type === "assignment");
    }

    applyPatches(patches) {
      const ordered = (patches || []).map(patch => ({
        start: Number(patch.start), end: Number(patch.end), text: String(patch.text ?? "")
      })).sort((left, right) => right.start - left.start);
      let previousStart = this.source.length + 1;
      let output = this.source;
      for (const patch of ordered) {
        if (!Number.isInteger(patch.start) || !Number.isInteger(patch.end) ||
            patch.start < 0 || patch.end < patch.start || patch.end > this.source.length || patch.end > previousStart) {
          throw new Error("Ungültiger oder überlappender Konfigurations-Patch");
        }
        output = output.slice(0, patch.start) + patch.text + output.slice(patch.end);
        previousStart = patch.start;
      }
      return output;
    }

    patchAssignment(assignment, value) {
      if (!assignment || assignment.type !== "assignment") throw new Error("Zuweisung nicht gefunden");
      return { start: assignment.valueStart, end: assignment.valueEnd, text: encodeValue(value, assignment.quote) };
    }
  }

  return {
    API_VERSION,
    ConfigDocument,
    parse: source => new ConfigDocument(source),
    encodeValue,
    decodeValue
  };
});
