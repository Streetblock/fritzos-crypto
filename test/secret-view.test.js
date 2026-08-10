const assert = require('node:assert/strict');
const { API_VERSION, SecretView } = require('../src/SecretView.js');

assert.equal(API_VERSION, '1');

const element = () => ({
  innerHTML: '', textContent: '', disabled: false, children: [], dataset: {},
  classList: { toggle() {} },
  append(...children) { this.children.push(...children); },
  appendChild(child) { this.children.push(child); },
  addEventListener() {}, querySelectorAll() { return []; }, setAttribute() {},
  focus() {}, select() {}
});
const elements = {
  list: element(), masterCard: element(), masterSection: element(),
  editorSection: element(), emptyState: element(), resultsSummary: element(),
  toggleAll: element()
};
const controller = {
  getDisplayStatus: secret => secret.status,
  getStatusLabel: () => null,
  isRevealed: secret => Boolean(secret.revealed),
  toggleReveal() {}, edit() {}, reset() {}, reveal() {}
};
const view = new SecretView({
  controller,
  elements,
  document: { createElement: () => element(), activeElement: null }
});

const secret = {
  id: 'secret-1', type: 4, status: 'decrypted', revealed: true,
  displayLabel: 'Passwort', category: 'vpn', editedPlaintext: 'klar', plaintext: 'klar'
};
view.render({ allSecrets: [secret], regularSecrets: [secret], visibleSecrets: [secret] });
assert.equal(elements.resultsSummary.textContent, '1 von 1 Fundstellen angezeigt');
assert.match(elements.toggleAll.innerHTML, /Alle verbergen/);
assert.equal(view.getCategoryName('vpn'), 'VPN');
assert.equal(view.getStatusStyle({ status: 'failed' }).label, 'Fehlgeschlagen');
assert.equal(elements.list.children.length, 1);
assert.throws(() => new SecretView(), /controller is required/);

console.log('SecretView tests passed.');
