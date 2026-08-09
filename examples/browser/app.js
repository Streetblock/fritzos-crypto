(() => {
  "use strict";

  const CryptoApi = window.FritzOSCrypto;
  const Editor = window.FritzExportEditor?.FritzExportEditor;
  const state = { originalText: "", text: "", fileName: "", password: "", masterKey: null, downloadText: "" };
  const byId = id => document.getElementById(id);

  function bytesToLatin1(bytes) {
    const chunks = [];
    for (let index = 0; index < bytes.length; index += 0x8000) {
      chunks.push(String.fromCharCode(...bytes.subarray(index, index + 0x8000)));
    }
    return chunks.join("");
  }

  function latin1Bytes(text) {
    return Uint8Array.from(text, character => character.charCodeAt(0) & 0xff);
  }

  function setStatus(message, kind = "") {
    byId("status").textContent = message;
    byId("status").className = kind;
  }

  function setVerification(message, kind = "") {
    byId("verification").textContent = message;
    byId("verification").className = kind;
  }

  async function decryptInventory(inventory, password, masterKey) {
    const values = new Map();
    for (const secret of inventory) {
      if (secret.category === "system") continue;
      try {
        const result = await CryptoApi.AVMCrypto.decryptSecret(secret.value, password, masterKey || undefined);
        values.set(secret.id, result.plaintext);
      } catch (_) {
        values.set(secret.id, null);
      }
    }
    return values;
  }

  function makeWifiCard(kind, secrets, decrypted) {
    const representative = secrets[0];
    const network = representative?.network || {};
    const ssid = network.ssidSecretId
      ? decrypted.get(network.ssidSecretId)
      : network.ssid;
    const passwordSecret = secrets.find(secret => /psk|password|key/i.test(secret.field) && !/ssid/i.test(secret.field));
    const password = passwordSecret ? decrypted.get(passwordSecret.id) : null;
    if (!passwordSecret && !ssid) return null;

    const card = document.createElement("article");
    card.className = `panel wifi-card ${kind === "guest" ? "guest" : ""}`;
    const label = kind === "guest" ? "Gast-WLAN" : "Haupt-WLAN";
    card.innerHTML = `
      <span class="label">${label}</span>
      <h2></h2>
      <label>WLAN-Schlüssel
        <span class="secret-row">
          <input type="password" readonly>
          <button class="secondary" type="button">Anzeigen</button>
        </span>
      </label>`;
    card.querySelector("h2").textContent = ssid || "SSID nicht erkannt";
    const input = card.querySelector("input");
    input.value = password == null ? "Nicht entschlüsselbar" : password;
    const toggle = card.querySelector("button");
    toggle.disabled = password == null;
    toggle.addEventListener("click", () => {
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      toggle.textContent = reveal ? "Maskieren" : "Anzeigen";
    });
    return card;
  }

  async function analyze() {
    const file = byId("file").files[0];
    const password = byId("password").value;
    byId("download").disabled = true;
    state.downloadText = "";
    if (!file || !password) return setStatus("Bitte Exportdatei und Sicherungskennwort angeben.", "error");

    try {
      setStatus("Export wird lokal gelesen und entschlüsselt …");
      const text = bytesToLatin1(new Uint8Array(await file.arrayBuffer()));
      if (!CryptoApi.FritzBoxParser.isExportFile(text)) throw new Error("Keine FRITZ!Box-Exportdatei erkannt");
      const inventory = CryptoApi.FritzBoxParser.extractSecretInventory(text);
      const masterSecret = inventory.find(secret => secret.category === "system" && secret.field.toLowerCase() === "password");
      const master = masterSecret ? CryptoApi.decryptExportKey(masterSecret.value, password) : null;
      const decrypted = await decryptInventory(inventory, password, master?.aesKeyBytes);
      const headerEnd = text.search(/^\*+\s+(?:CFGFILE|(?:CRYPTED)?B64FILE|BINFILE):/m);
      const metadata = CryptoApi.FritzBoxParser.parseHeader(text.slice(0, headerEnd < 0 ? undefined : headerEnd));

      state.originalText = text;
      state.text = text;
      state.fileName = file.name;
      state.password = password;
      state.masterKey = master;
      byId("model").textContent = metadata.Modell || "Unbekannt";
      byId("firmware").textContent = metadata.FirmwareVersion || "Unbekannt";
      byId("master-key").textContent = master ? "•".repeat(32) : "Legacy-Export ohne Export-Master-Key";
      byId("toggle-key").disabled = !master;
      byId("password-change").hidden = !master;

      const wifi = byId("wifi");
      wifi.replaceChildren();
      for (const [kind, category] of [["main", "wlan"], ["guest", "guest-wlan"]]) {
        const card = makeWifiCard(kind, inventory.filter(secret => secret.category === category), decrypted);
        if (card) wifi.append(card);
      }
      if (!wifi.children.length) wifi.textContent = "Keine WLAN-Zugangsdaten erkannt.";

      byId("result").hidden = false;
      setStatus(`${inventory.length} Secret-Felder erkannt.`, "ok");
      setVerification("");
    } catch (error) {
      byId("result").hidden = true;
      setStatus(error.message || String(error), "error");
    }
  }

  async function changePassword() {
    const newPassword = byId("new-password").value;
    const confirmation = byId("confirm-password").value;
    if (!state.masterKey) return setVerification("Dieser Export besitzt keinen modernen Export-Master-Key.", "error");
    if (!newPassword || newPassword !== confirmation) return setVerification("Die neuen Kennwörter fehlen oder stimmen nicht überein.", "error");

    try {
      byId("change-password").disabled = true;
      byId("download").disabled = true;
      const result = await Editor.changeExportPassword({
        text: state.text,
        oldPassword: state.password,
        newPassword,
        onStep: event => setVerification(event.message)
      });
      state.text = result.updatedText;
      state.password = newPassword;
      state.downloadText = result.updatedText;
      state.masterKey = CryptoApi.decryptExportKey(result.newWrappedKey, newPassword);
      byId("master-key").textContent = "•".repeat(32);
      byId("new-password").value = "";
      byId("confirm-password").value = "";
      byId("download").disabled = false;
      setVerification(`Secret-Roundtrip erfolgreich · CRC32 ${result.checksum.newCrc} gültig`, "ok");
    } catch (error) {
      setVerification(error.message || String(error), "error");
    } finally {
      byId("change-password").disabled = false;
    }
  }

  function download() {
    if (!state.downloadText) return;
    const blob = new Blob([latin1Bytes(state.downloadText)], { type: "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = state.fileName.replace(/\.export$/i, "") + "-neues-kennwort.export";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  byId("analyze").addEventListener("click", analyze);
  byId("change-password").addEventListener("click", changePassword);
  byId("download").addEventListener("click", download);
  byId("toggle-key").addEventListener("click", () => {
    if (!state.masterKey) return;
    const hidden = byId("master-key").textContent.includes("•");
    byId("master-key").textContent = hidden ? CryptoApi.toHex(state.masterKey.exportKeyBytes) : "•".repeat(32);
    byId("toggle-key").textContent = hidden ? "Maskieren" : "Anzeigen";
  });
})();
