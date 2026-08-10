const assert = require('node:assert/strict');
const { API_VERSION, TelephonyView } = require('../src/TelephonyView.js');

assert.equal(API_VERSION, '1');

const element = () => ({
  value: '', textContent: '', innerHTML: '', className: '', disabled: false,
  children: [], classList: { add() {}, remove() {} },
  appendChild(child) { this.children.push(child); if (!this.value) this.value = child.value; },
  focus() { this.focused = true; }
});
const elements = {
  account: element(), navCount: element(), notice: element(), websocket: element(),
  connect: element(), status: element(), call: element(), hangup: element(),
  incoming: element(), incomingCaller: element(), message: element(),
  selectedContact: element(), dialTarget: element()
};
let iconsRendered = 0;
const view = new TelephonyView({
  elements,
  document: { createElement: () => element() },
  createIcons: () => { iconsRendered += 1; }
});

view.renderAccounts([{ id: 'a', providerName: 'Sipgate', username: 'user', registrar: 'sipgate.de' }], 'Bereit');
assert.equal(elements.navCount.textContent, 1);
assert.equal(elements.account.children[0].value, 'a');
assert.equal(elements.notice.textContent, 'Bereit');

view.renderAccountPreview({ websocket: 'wss://example.test' }, false);
assert.equal(elements.websocket.textContent, 'wss://example.test');
assert.equal(elements.connect.disabled, false);

view.renderState({ phoneState: 'registered', hasAccount: true, registered: true, busy: false });
assert.match(elements.status.innerHTML, /Mit Sipgate verbunden/);
assert.match(elements.connect.innerHTML, /Verbindung trennen/);
assert.equal(elements.call.disabled, false);
assert.equal(iconsRendered, 1);

view.showSelectedContact({ name: 'Ada', book: 'Telefonbuch', number: '0123' });
assert.equal(elements.dialTarget.value, '0123');
assert.equal(elements.dialTarget.focused, true);

console.log('TelephonyView tests passed.');
