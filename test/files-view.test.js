const assert = require('node:assert/strict');
const { API_VERSION, FilesView } = require('../src/FilesView.js');

assert.equal(API_VERSION, '1');

const element = () => ({
  textContent: '', innerHTML: '', className: '', children: [], open: false,
  classList: { toggle() {}, add() {}, remove() {} },
  append(...children) { this.children.push(...children); },
  appendChild(child) { this.children.push(child); return child; },
  addEventListener() {}, setAttribute() {}
});
const elements = {
  navCount: element(), overviewCard: element(), overviewSummary: element(),
  phonebookSection: element(), phonebookSummary: element(), errors: element(),
  phonebooks: element(), xml: element(), embeddedSection: element(),
  embeddedSummary: element(), embedded: element(), emptyState: element()
};
let iconsRendered = 0;
const view = new FilesView({
  elements,
  document: { createElement: () => element() },
  createFilePreview: file => ({ kind: 'text', content: file.content || '', truncated: false }),
  humanizeField: value => `Feld ${value}`,
  createIcons: () => { iconsRendered += 1; }
});

view.render({
  files: [{ type: 'B64FILE', name: 'notes', line: 4, bytes: new Uint8Array([1]), content: 'Text' }],
  phonebookFiles: [{ type: 'B64FILE', name: 'phonebook', line: 8, bytes: new Uint8Array([1]), content: '<xml />' }],
  books: [{
    name: 'Telefonbuch', sourceLine: 8, sourceName: 'phonebook',
    contacts: [{ name: 'Ada', category: '', numbers: [{ value: '0123', type: 'mobile' }] }]
  }],
  errors: []
}, '');

assert.equal(elements.navCount.textContent, 1);
assert.match(elements.overviewSummary.textContent, /1 Telefonbuch/);
assert.match(elements.phonebookSummary.textContent, /1 Kontakte/);
assert.equal(elements.embedded.children.length, 1);
assert.equal(elements.phonebooks.children.length, 1);
assert.equal(elements.xml.children.length, 1);
assert.equal(view.getPhoneNumberTypeLabel('mobile'), 'Mobil');
assert.equal(view.getPhoneNumberTypeLabel('custom'), 'Feld custom');
assert.equal(iconsRendered, 1);
assert.throws(() => new FilesView(), /createFilePreview is required/);

console.log('FilesView tests passed.');
