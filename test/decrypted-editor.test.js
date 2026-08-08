const assert = require('node:assert/strict');
const Editor = require('../DecryptedEditor.js');

const cipher = '$$$$SECRET';
const source = `before\nvalue = "${cipher}";\nafter\n`;
const secret = {
  id: 'secret-1', stableKey: 'value|1', value: cipher,
  start: source.indexOf(cipher), end: source.indexOf(cipher) + cipher.length,
  status: 'decrypted', plaintext: 'clear', editedPlaintext: 'clear', type: 4
};

let model = Editor.buildDocument(source, [secret]);
assert.equal(model.text, 'before\nvalue = "clear";\nafter\n');

let result = Editor.applyEdit(model, model.text.replace('clear', 'new value'), source);
assert.deepEqual(result, { kind: 'secret', secretId: 'secret-1', plaintext: 'new value' });

const mapping = model.mappings[0];
result = Editor.applyEdit(model, model.text.slice(0, mapping.start) + 'X' + model.text.slice(mapping.start), source);
assert.equal(result.plaintext, 'Xclear', 'typing at the first plaintext character must edit the secret');
result = Editor.applyEdit(model, model.text.slice(0, mapping.end) + 'X' + model.text.slice(mapping.end), source);
assert.equal(result.plaintext, 'clearX', 'typing after the final plaintext character must edit the secret');

result = Editor.applyEdit(model, model.text.replace('before', 'changed'), source);
assert.equal(result.kind, 'structure');
assert.equal(result.workingText, source.replace('before', 'changed'));
assert.equal(result.workingText.includes('clear'), false, 'plaintext must never be copied into the encrypted working export');

result = Editor.applyEdit(model, model.text.replace('value = "clear"', 'removed'), source);
assert.equal(result.kind, 'conflict', 'edits crossing a secret boundary must be rejected');

const systemModel = Editor.buildDocument(source, [Object.assign({}, secret, { type: null })]);
result = Editor.applyEdit(systemModel, systemModel.text.replace('clear', 'unsafe'), source);
assert.equal(result.kind, 'conflict', 'unsupported system secrets must stay read-only inside the decrypted document');

const escaped = Object.assign({}, secret, { editedPlaintext: 'say "hi" \\ ok' });
model = Editor.buildDocument(source, [escaped]);
assert.match(model.text, /say \\"hi\\" \\\\ ok/);
result = Editor.applyEdit(model, model.text.replace('ok', 'fine'), source);
assert.equal(result.plaintext, 'say "hi" \\ fine');

console.log('Decrypted editor mapping tests passed.');
