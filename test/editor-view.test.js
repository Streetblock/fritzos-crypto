const assert = require('node:assert/strict');
const { API_VERSION, EditorView } = require('../src/EditorView.js');

assert.equal(API_VERSION, '1');
const element = () => ({
  value: '', textContent: '', innerHTML: '', scrollTop: 0, clientHeight: 100,
  children: [], classList: { toggle() {} },
  appendChild(child) { this.children.push(child); },
  addEventListener() {}, focus() {}, setSelectionRange(start, end) { this.selection = [start, end]; }
});
const elements = {
  editor: element(), charCount: element(), lineNumbers: element(),
  sectionNav: element(), shell: element(), themeButton: element()
};
elements.editor.value = 'Header\n**** CFGFILE:ar7.cfg\nvalue';
const view = new EditorView({
  elements,
  document: { createElement: () => element() },
  getComputedStyle: () => ({ lineHeight: '20px' }),
  requestFrame: callback => callback()
});
view.updateTextMetrics();
assert.match(elements.charCount.textContent, /Zeichen/);
assert.equal(elements.lineNumbers.textContent, '1\n2\n3');
assert.equal(elements.sectionNav.children.length, 2);
assert.deepEqual(view.getLineRange(2), { start: 7, end: 27, line: 2 });
view.focusLine(2);
assert.deepEqual(elements.editor.selection, [7, 27]);
view.applyTheme('preview', 'console');
assert.match(elements.themeButton.innerHTML, /Editor-Look/);
console.log('EditorView tests passed.');
