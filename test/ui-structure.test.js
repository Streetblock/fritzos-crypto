const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

assert.deepEqual(duplicateIds, [], 'UI element ids must be unique');

for (const id of [
  'welcomeSection',
  'welcomeDropZone',
  'workspaceSection',
  'viewOverview',
  'viewSecrets',
  'viewEditor',
  'secretEditorSection',
  'editorContent'
]) {
  assert.equal(ids.includes(id), true, `required UI element #${id} is missing`);
}

const navigationViews = [...html.matchAll(/class="[^"]*workspace-nav[^"]*"[^>]*data-view="([^"]+)"|data-view="([^"]+)"[^>]*class="[^"]*workspace-nav[^"]*"/g)]
  .map(match => match[1] || match[2])
  .sort();
const panelViews = [...html.matchAll(/data-view-panel="([^"]+)"/g)].map(match => match[1]).sort();
assert.deepEqual(navigationViews, panelViews, 'every navigation item must have one matching view panel');

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());
for (const source of inlineScripts) new Function(source);

assert.equal((html.match(/<body\b/gi) || []).length, 1, 'document must contain one body');
assert.equal((html.match(/<\/body>/gi) || []).length, 1, 'document must close the body once');
assert.equal(html.includes('id="btnEncrypt"'), false, 'unsafe whole-editor encryption must not return');

console.log('UI structure regression tests passed.');
