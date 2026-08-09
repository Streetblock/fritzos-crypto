#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const { FritzOSCrypto, AVMCrypto, FritzBoxParser } = require("../..");

async function main() {
  const fileName = process.argv[2];
  const password = process.env.FRITZ_EXPORT_PASSWORD;
  if (!fileName || !password) {
    console.error("Aufruf: FRITZ_EXPORT_PASSWORD=... node examples/node/inspect-export.js <datei.export>");
    process.exitCode = 2;
    return;
  }

  const text = fs.readFileSync(fileName).toString("latin1");
  if (!FritzBoxParser.isExportFile(text)) throw new Error("Keine FRITZ!Box-Exportdatei erkannt");
  const inventory = FritzBoxParser.extractSecretInventory(text);
  const masterSecret = inventory.find(secret => secret.category === "system" && secret.field.toLowerCase() === "password");
  const master = masterSecret ? FritzOSCrypto.decryptExportKey(masterSecret.value, password) : null;
  const headerEnd = text.search(/^\*+\s+(?:CFGFILE|(?:CRYPTED)?B64FILE|BINFILE):/m);
  const metadata = FritzBoxParser.parseHeader(text.slice(0, headerEnd < 0 ? undefined : headerEnd));

  console.log(`Modell: ${metadata.Modell || "unbekannt"}`);
  console.log(`Firmware: ${metadata.FirmwareVersion || "unbekannt"}`);
  console.log(`Export-Master-Key: ${master ? FritzOSCrypto.toHex(master.exportKeyBytes) : "Legacy-Export"}`);

  for (const category of ["wlan", "guest-wlan"]) {
    const secrets = inventory.filter(secret => secret.category === category);
    const passwordSecret = secrets.find(secret => /psk|password|key/i.test(secret.field) && !/ssid/i.test(secret.field));
    if (!passwordSecret) continue;
    const decrypted = await AVMCrypto.decryptSecret(passwordSecret.value, password, master?.aesKeyBytes);
    const network = passwordSecret.network || {};
    let ssid = network.ssid;
    if (network.ssidSecretId) {
      const ssidSecret = secrets.find(secret => secret.id === network.ssidSecretId);
      if (ssidSecret) ssid = (await AVMCrypto.decryptSecret(ssidSecret.value, password, master?.aesKeyBytes)).plaintext;
    }
    console.log(`${category === "wlan" ? "Haupt-WLAN" : "Gast-WLAN"}: ${ssid || "SSID unbekannt"} · ${decrypted.plaintext}`);
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
