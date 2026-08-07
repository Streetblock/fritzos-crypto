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
  'unsavedChangesBadge',
  'btnRestoreOriginal',
  'btnSave',
  'viewOverview',
  'viewSecrets',
  'exportSafetyPanel',
  'downloadGateStatus',
  'roundtripCheck',
  'roundtripCheckMessage',
  'checksumCheck',
  'checksumCheckMessage',
  'reencryptSummary',
  'reencryptSummaryList',
  'autoValidationStatus',
  'autoValidationBadge',
  'viewEditor',
  'credentialCards',
  'wifiCardsSection',
  'wifiCards',
  'sipCardsSection',
  'sipCards',
  'secretEditorSection',
  'btnToggleAllSecrets',
  'secretSearch',
  'secretCategoryFilter',
  'secretStatusFilter',
  'secretResultsSummary',
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
assert.equal(html.includes('<Binärer Master-Key (entschlüsselt)>'), false, 'master key placeholder must not hide the actual decrypted key');
assert.match(html, /plaintext:\s*mkResult\.exportKeyHex/, 'decrypted master key must be available to the masked secret field');
assert.match(html, /input\.type\s*=\s*this\.revealedSecrets\.has\(secret\.stableKey\)\s*\?\s*'text'\s*:\s*'password'/, 'plaintext fields must be masked by default');
for (const action of ['Anzeigen', 'Kopieren', 'Bearbeiten', 'Zurücksetzen']) {
  assert.equal(html.includes(`'${action}'`), true, `secret action ${action} is missing`);
}
assert.equal(html.includes('Alle anzeigen'), true, 'global reveal action is missing');
assert.equal(html.includes('Alle verbergen'), true, 'global hide action is missing');
assert.equal(html.includes('In Zwischenablage kopieren'), true, 'SIP clipboard action is missing');
assert.equal(/href\s*=\s*["']sip:/i.test(html), false, 'SIP cards must not launch a softphone');
assert.equal(html.includes('qrcode_UTF8.js'), true, 'UTF-8 QR encoding support is missing');
assert.match(html, /this\.btnSave\.disabled\s*=\s*!ready/, 'download button must follow the verification gate');
assert.match(html, /this\.state\.isDownloadReady\(\)/, 'download handler must verify both safety checks');
assert.equal(html.includes('1. Secret-Roundtrip'), true, 'roundtrip verification step is missing');
assert.equal(html.includes('2. CRC32-Prüfung'), true, 'checksum verification step is missing');
assert.equal(html.includes('Ungespeicherte Änderungen'), true, 'unsaved changes indicator is missing');
assert.equal(html.includes('Originaldatei wiederherstellen?'), true, 'original restore flow is missing');
assert.match(html, /this\.autoValidationDelay\s*=\s*15000/, 'automatic validation must wait for a typing pause');
assert.match(html, /setTimeout\(\(\)\s*=>[\s\S]*this\.reencryptChangedSecrets\(generation\)/, 'debounced validation trigger is missing');
assert.equal(html.includes('Jetzt neu verschlüsseln und prüfen'), false, 'manual double-confirmation must not return');
assert.match(html, /<details id="reencryptSummary"/, 'change overview must be collapsible');
for (const status of ['pending', 'decrypted', 'changed', 'failed']) {
  assert.equal(html.includes(`<option value="${status}">`), true, `secret status filter ${status} is missing`);
}

console.log('UI structure regression tests passed.');
