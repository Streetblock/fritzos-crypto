/**
 * AVM export checksum implementation adapted from
 * https://github.com/Streetblock/fritzbox-checksum-fixer
 * Copyright (c) 2026 Streetblock, MIT License.
 */
(function (global, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    global.FritzExportChecksum = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  class FritzExportChecksum {
    constructor(text) {
      this.text = text;
      this.crc = 0;
      this.oldCrc = null;
    }

    static fromText(text) {
      return new FritzExportChecksum(text);
    }

    static fromBytes(bytes) {
      return new FritzExportChecksum(FritzExportChecksum.bytesToLatin1(bytes));
    }

    static splitLinesKeepEnds(text) {
      const lines = text.match(/[^\r\n]*(?:\r\n|\n|$)/g) || [];
      if (lines.length && lines[lines.length - 1] === "") {
        lines.pop();
      }
      return lines;
    }

    static stripEol(line) {
      if (line.endsWith("\r\n")) return line.slice(0, -2);
      if (line.endsWith("\n")) return line.slice(0, -1);
      return line;
    }

    static bytesToLatin1(bytes) {
      let out = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        out += String.fromCharCode.apply(null, chunk);
      }
      return out;
    }

    static latin1ToBytes(str) {
      const out = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        out[i] = str.charCodeAt(i) & 0xff;
      }
      return out;
    }

    static hexToBytes(hex) {
      const clean = hex.trim();
      if (clean.length % 2 !== 0) {
        throw new Error("Ungültige Hex-Zeile in BINFILE");
      }
      const out = new Uint8Array(clean.length / 2);
      for (let i = 0; i < clean.length; i += 2) {
        out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
      }
      return out;
    }

    static base64ToBytes(base64) {
      const clean = base64.trim();
      if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(clean, "base64"));
      }
      const bin = atob(clean);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
      }
      return out;
    }

    updateCrc(data) {
      let bytes;
      if (typeof data === "string") {
        bytes = FritzExportChecksum.latin1ToBytes(data);
      } else if (data instanceof Uint8Array) {
        bytes = data;
      } else {
        throw new Error("Unsupported data type for CRC update");
      }
      this.crc = FritzExportChecksum.crc32(bytes, this.crc);
    }

    static crc32(bytes, previous = 0) {
      let crc = (previous ^ 0xffffffff) >>> 0;

      for (let i = 0; i < bytes.length; i++) {
        crc ^= bytes[i];
        for (let j = 0; j < 8; j++) {
          const mask = -(crc & 1);
          crc = ((crc >>> 1) ^ (0xedb88320 & mask)) >>> 0;
        }
      }

      return (crc ^ 0xffffffff) >>> 0;
    }

    calculate() {
      const RE_ROOT = /^\*+.*CONFIGURATION EXPORT.*/;
      const RE_ENDROOT = /\*+\s+END OF EXPORT\s+([0-9A-Fa-f]{8})\s+\*+/;
      const RE_DEFROOT = /^(\w+)\s*=\s*(.*?)\s*(?:\r?\n)?$/;
      const RE_BINFILE = /^\*+\s+(?:CRYPTED)?BINFILE:\s*([^\s]+)\s*.*$/;
      const RE_B64FILE = /^\*+\s+(?:CRYPTED)?B64FILE:\s*([^\s]+)\s*.*$/;
      const RE_CFGFILE = /^\*+\s+CFGFILE:\s*([^\s]+)\s*.*$/;
      const RE_ENDFILE = /^\*+\s+END OF FILE\s+\*+.*$/;

      let state = "NONE";
      let lastCfgLine = null;

      const lines = FritzExportChecksum.splitLinesKeepEnds(this.text);

      for (const originalLine of lines) {
        const line = originalLine.replace(/\\\\/g, "\\");
        const lineNoEol = FritzExportChecksum.stripEol(line);

        if (state === "NONE") {
          if (RE_ROOT.test(lineNoEol)) {
            state = "ROOT";
          }
          continue;
        }

        if (state === "ROOT") {
          let m = lineNoEol.match(RE_ENDROOT);
          if (m) {
            this.oldCrc = m[1].toUpperCase();
            break;
          }

          m = lineNoEol.match(RE_DEFROOT);
          if (m) {
            this.updateCrc(m[1] + m[2] + "\0");
            continue;
          }

          m = lineNoEol.match(RE_BINFILE);
          if (m) {
            state = "BINFILE";
            this.updateCrc(m[1] + "\0");
            continue;
          }

          m = lineNoEol.match(RE_B64FILE);
          if (m) {
            state = "B64FILE";
            this.updateCrc(m[1] + "\0");
            continue;
          }

          m = lineNoEol.match(RE_CFGFILE);
          if (m) {
            state = "CFGFILE";
            lastCfgLine = null;
            this.updateCrc(m[1] + "\0");
            continue;
          }
        } else if (state === "BINFILE") {
          if (RE_ENDFILE.test(lineNoEol)) {
            state = "ROOT";
            continue;
          }

          const payload = FritzExportChecksum.stripEol(line).trim();
          if (payload) {
            this.updateCrc(FritzExportChecksum.hexToBytes(payload));
          }
          continue;
        } else if (state === "B64FILE") {
          if (RE_ENDFILE.test(lineNoEol)) {
            state = "ROOT";
            continue;
          }

          const payload = FritzExportChecksum.stripEol(line).trim();
          if (payload) {
            this.updateCrc(FritzExportChecksum.base64ToBytes(payload));
          }
          continue;
        } else if (state === "CFGFILE") {
          if (RE_ENDFILE.test(lineNoEol)) {
            if (lastCfgLine !== null) {
              this.updateCrc(FritzExportChecksum.stripEol(lastCfgLine));
              lastCfgLine = null;
            }
            state = "ROOT";
            continue;
          }

          if (lastCfgLine !== null) {
            this.updateCrc(lastCfgLine);
          }

          lastCfgLine = line;
          continue;
        }
      }

      if (!this.oldCrc) {
        throw new Error("END OF EXPORT nicht gefunden");
      }

      return {
        oldCrc: this.oldCrc,
        newCrc: this.crc.toString(16).toUpperCase().padStart(8, "0"),
      };
    }

    replaceChecksum() {
      const result = this.calculate();

      // Hier ist /m wichtig, weil auf dem gesamten Text ersetzt wird
      const endRootRegex = /^(\*+\s+END OF EXPORT\s+)([0-9A-Fa-f]{8})(\s+\*+.*)$/m;

      const updatedText = this.text.replace(endRootRegex, (_, p1, _old, p3) => {
        return p1 + result.newCrc + p3;
      });

      return {
        oldCrc: result.oldCrc,
        newCrc: result.newCrc,
        updatedText,
      };
    }

    replaceChecksumAsBytes() {
      const result = this.replaceChecksum();
      return {
        oldCrc: result.oldCrc,
        newCrc: result.newCrc,
        updatedBytes: FritzExportChecksum.latin1ToBytes(result.updatedText),
      };
    }
  }

  return FritzExportChecksum;
});
