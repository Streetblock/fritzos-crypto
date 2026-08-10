'use strict';

const assert = require('node:assert/strict');
const { API_VERSION, EditorController } = require('../src/EditorController.js');

function createController(overrides = {}) {
  const commits = [];
  const statuses = [];
  const state = overrides.state || {
    viewMode: 'preview',
    workingText: 'encrypted source',
    secrets: [],
    createPreview(replaceSecret) {
      this.viewMode = 'preview';
      return replaceSecret(this.workingText, {}, 'plain');
    }
  };
  const editor = overrides.editor || {
    value: 'edited preview',
    selectionStart: 7,
    setSelectionRange(start, end) { this.selection = [start, end]; }
  };
  const decryptedEditor = overrides.decryptedEditor || {
    applyEdit: () => ({ kind: 'secret', secretId: 'secret-1', plaintext: 'changed' }),
    buildDocument: () => ({ text: 'rendered preview' })
  };
  const controller = new EditorController({
    state,
    editor,
    decryptedEditor,
    replaceSecret: text => text,
    commitMutation: (mutation, options) => commits.push({ mutation, options }),
    onStatus: (message, tone) => statuses.push({ message, tone }),
    onTextRendered: () => { editor.rendered = true; }
  });
  return { controller, state, editor, commits, statuses };
}

assert.equal(API_VERSION, '1');

const preview = createController();
preview.controller.handleInput();
assert.deepEqual(preview.commits, [{
  mutation: { kind: 'secret', secretId: 'secret-1', plaintext: 'changed' },
  options: { selection: 7 }
}]);

const working = createController({ state: {
  viewMode: 'working',
  workingText: 'old',
  secrets: [],
  createPreview() {}
} });
working.editor.value = 'new structure';
working.controller.handleInput();
assert.deepEqual(working.commits[0].mutation, { kind: 'structure', workingText: 'new structure' });

const conflict = createController({ decryptedEditor: {
  applyEdit: () => ({ kind: 'conflict', message: 'Konflikt' }),
  buildDocument: () => ({ text: 'restored preview' })
} });
conflict.controller.handleInput();
assert.equal(conflict.commits.length, 0);
assert.deepEqual(conflict.statuses, [{
  message: 'Konflikt Bitte Secret und Struktur nacheinander bearbeiten.',
  tone: 'warning'
}]);
assert.equal(conflict.editor.value, 'restored preview');
assert.deepEqual(conflict.editor.selection, [7, 7]);

conflict.controller.clearModel();
assert.equal(conflict.controller.model, null);

console.log('Editor controller tests passed.');
