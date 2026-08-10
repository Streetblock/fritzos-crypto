const assert = require('node:assert/strict');
const { API_VERSION, SecretView } = require('../src/SecretView.js');

assert.equal(API_VERSION, '1');

const element = () => ({
  innerHTML: '', textContent: '', disabled: false, children: [],
  classList: { toggle() {} },
  appendChild(child) { this.children.push(child); },
  addEventListener() {}, querySelectorAll() { return []; }
});
const elements = {
  list: element(), masterCard: element(), masterSection: element(),
  editorSection: element(), emptyState: element(), resultsSummary: element(),
  toggleAll: element()
};
const controller = {
  getDisplayStatus: secret => secret.status,
  getStatusLabel: () => null,
  isRevealed: secret => Boolean(secret.revealed)
};
const view = new SecretView({
  controller,
  elements,
  document: { createElement: () => element(), activeElement: null }
});

const secret = { status: 'decrypted', revealed: true };
view.prepare({ allSecrets: [secret], regularSecrets: [secret], visibleSecrets: [secret] });
assert.equal(elements.resultsSummary.textContent, '1 von 1 Fundstellen angezeigt');
assert.match(elements.toggleAll.innerHTML, /Alle verbergen/);
assert.equal(view.getCategoryName('vpn'), 'VPN');
assert.equal(view.getStatusStyle({ status: 'failed' }).label, 'Fehlgeschlagen');
assert.throws(() => new SecretView(), /controller is required/);

console.log('SecretView tests passed.');
