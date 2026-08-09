"use strict";

if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = require("node:crypto").webcrypto;
}
if (typeof globalThis.pako === "undefined") globalThis.pako = require("pako");
if (typeof globalThis.CryptoJS === "undefined") globalThis.CryptoJS = require("crypto-js");

const FritzOSCrypto = require("./FritzOSCrypto.js");
const FritzExportChecksum = require("./FritzExportChecksum.js");
const ExportEditorApi = require("./FritzExportEditor.js");
const FritzWireGuardKeys = require("./FritzWireGuardKeys.js");

module.exports = {
  FritzOSCrypto,
  AVMCrypto: FritzOSCrypto.AVMCrypto,
  FritzBoxParser: FritzOSCrypto.FritzBoxParser,
  FritzExportChecksum,
  FritzExportEditor: ExportEditorApi.FritzExportEditor,
  FritzExportEditorError: ExportEditorApi.FritzExportEditorError,
  FritzWireGuardKeys
};
