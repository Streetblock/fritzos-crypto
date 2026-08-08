const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
const cryptoSource = fs.readFileSync(require.resolve('../FritzOSCrypto.js'), 'utf8');
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
  'viewFiles',
  'fileNavCount',
  'phonebookOverviewCard',
  'phonebookOverviewSummary',
  'phonebookViewerSection',
  'phonebookViewerSummary',
  'phonebookSearch',
  'phonebookViewerErrors',
  'phonebookViewer',
  'phonebookXmlViewer',
  'embeddedFileViewerSection',
  'embeddedFileViewerSummary',
  'embeddedFileViewer',
  'filesEmptyState',
  'exportSafetyPanel',
  'exportMasterKeySection',
  'exportMasterKeyCard',
  'btnTogglePasswordChange',
  'passwordChangePanel',
  'currentExportPassword',
  'newExportPassword',
  'confirmExportPassword',
  'passwordChangeStatus',
  'btnCancelPasswordChange',
  'btnChangeExportPassword',
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
  'internalTelephonyCardsSection',
  'internalTelephonyCards',
  'phonebookCardsSection',
  'phonebookCards',
  'fritzAccessCardsSection',
  'fritzAccessCards',
  'onlineServiceCardsSection',
  'onlineServiceCards',
  'providerAccessCardsSection',
  'providerAccessCards',
  'vpnCardsSection',
  'vpnCards',
  'secretEditorSection',
  'btnToggleAllSecrets',
  'secretSearch',
  'secretCategoryFilter',
  'secretStatusFilter',
  'secretResultsSummary',
  'editorShell',
  'editorLineNumbers',
  'editorSectionNav',
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
assert.match(html, /id="editorContent"[\s\S]*?wrap="off"/, 'expert editor must keep logical lines aligned with its gutter');
assert.match(html, /h-\[calc\(100vh-19rem\)\]/, 'expert editor must use the available viewport height');
assert.match(html, /this\.editorLineNumbers\.scrollTop\s*=\s*this\.editor\.scrollTop/, 'line number gutter must follow editor scrolling');
assert.match(html, /CFGFILE\|\(\?:CRYPTED\)\?BINFILE\|\(\?:CRYPTED\)\?B64FILE/, 'editor section navigation must recognize export file markers');
assert.match(html, /button\.addEventListener\('click', \(\) => this\.jumpToEditorLine\(section\.line\)\)/, 'section markers must navigate to their source line');
assert.match(html, /createSecretLocationLink\(secret/, 'secret locations must use the shared editor navigation link');
assert.match(html, /this\.jumpToEditorLine\(secret\.line\)/, 'secret location links must navigate to the exact source line');
assert.equal((html.match(/this\.createSecretLocationLink\(secret/g) || []).length >= 5, true, 'secret list, audit and credential cards must expose source links');
assert.equal(html.includes('<Binärer Master-Key (entschlüsselt)>'), false, 'master key placeholder must not hide the actual decrypted key');
assert.equal(cryptoSource.includes('System-Master-Key'), false, 'the misleading system master key label must not return');
assert.equal(cryptoSource.includes('Export-Master-Key'), true, 'the export master key needs its precise label');
assert.match(html, /exportSafetyPanel[\s\S]*exportMasterKeySection[\s\S]*credentialCards/, 'export master key card must appear between export safety and credential cards');
assert.match(html, /this\.isExportMasterKey\(secret\) \? this\.exportMasterKeyCard : this\.secretEditorList/, 'export master key must render in its dedicated top card');
assert.equal(cryptoSource.includes('encryptExportKey'), true, 'crypto library must support rewrapping the export master key');
assert.equal(html.includes('Kennwort ändern und prüfen'), true, 'password change needs one explicit verified action');
assert.equal(html.includes('Der Export-Master-Key bleibt unverändert'), true, 'password change UI must explain that the master key is preserved');
assert.match(html, /const editable = supported && !this\.isExportMasterKey\(secret\)/, 'the export master key itself must stay read-only');
assert.match(html, /this\.exportEditor\.changeExportPassword\(/, 'password changes must delegate to the atomic export service');
assert.match(html, /newPassword !== confirmation/, 'the new export password must be confirmed');
assert.match(html, /FritzExportEditor\.js\?v=20260808-1/, 'password change service needs a deployment cache key');
assert.match(html, /typeof window\.FritzExportEditor\?\.FritzExportEditor\?\.changeExportPassword/, 'partial deployments must reject a missing password change service');
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
assert.match(html, /markReencrypted\(/, 'validated changes must retain their audit state');
assert.equal(html.includes('Geändert · validiert'), true, 'validated change label is missing');
assert.match(html, /ConfigState\.js\?v=\d{8}-\d+/, 'local state script needs a deployment cache key');
assert.equal(html.includes("ConfigState API v2"), true, 'state compatibility guard is missing');
assert.equal(html.includes('Die Programmdateien wurden nicht gemeinsam aktualisiert.'), true, 'partial deployment must fail with a useful message');
assert.match(html, /FritzExportEditor\.js\?v=\d{8}-\d+/, 'atomic export editor needs a deployment cache key');
assert.equal(html.includes('FritzExportEditor API v1'), true, 'export editor compatibility guard is missing');
assert.match(html, /FritzEmbeddedFiles\.js\?v=\d{8}-\d+/, 'embedded file decoder needs a deployment cache key');
assert.equal(html.includes('FritzEmbeddedFiles API v1'), true, 'embedded file decoder compatibility guard is missing');
assert.match(html, /typeof window\.FritzEmbeddedFiles\?\.createFilePreview/, 'partial deployments must reject a missing generic preview service');
assert.match(html, /this\.embeddedFiles\.extractPhonebooks\(text\)/, 'loaded exports must be scanned for embedded phonebooks');
assert.match(html, /this\.jumpToEditorLine\(entry\.book\.sourceLine\)/, 'phonebooks must link back to their source block');
assert.equal(html.includes('Dekodierte XML-Quelldatei anzeigen'), true, 'phonebook cards must expose their decoded XML source on demand');
assert.match(html, /this\.phonebookXmlViewer\.appendChild\(details\)/, 'decoded phonebook XML must render below the structured phonebooks');
assert.match(html, /file\.type === 'B64FILE'/, 'generic file viewer must only expose decoded plain B64 files');
assert.match(html, /file\.name\.toLowerCase\(\) !== 'phonebook'/, 'structured phonebooks must not be duplicated in the generic file viewer');
assert.match(html, /this\.embeddedFiles\.createFilePreview\(file\)/, 'generic files must use the safe decoded preview service');
assert.match(html, /this\.jumpToEditorLine\(file\.line\)/, 'generic embedded files must link back to their source block');
assert.match(html, /this\.phonebookOverviewCard\?\.addEventListener\('click', \(\) => this\.switchView\('files'\)\)/, 'overview phonebook summary must open the files page');
assert.equal(html.includes('separat Base64-kodierten Zeilen'), false, 'line-wise Base64 encoding is an implementation detail, not user-facing copy');
const reencryptWorkflow = html.match(/async reencryptChangedSecrets[\s\S]*?(?=\n\s*async handleDecrypt)/)?.[0] || '';
assert.match(reencryptWorkflow, /this\.exportEditor\.applySecretChanges/, 'UI must delegate export mutations to the domain service');
assert.equal(reencryptWorkflow.includes('encryptSecretWithKey'), false, 'UI must not implement secret encryption itself');
assert.equal(reencryptWorkflow.includes('replaceChecksum'), false, 'UI must not implement checksum mutation itself');
assert.match(html, /this\.exportEditor\.verifyExportChecksum\(content\)/, 'final download guard must use the domain service');
for (const status of ['pending', 'decrypted', 'changed', 'failed']) {
  assert.equal(html.includes(`<option value="${status}">`), true, `secret status filter ${status} is missing`);
}
for (const category of ['fritz-user', 'app-access', 'email', 'myfritz', 'dyndns', 'remote-management', 'avm-remote-ddns', 'online-phonebook', 'telephony', 'internal-telephony']) {
  assert.equal(html.includes(`<option value="${category}">`), true, `secret category filter ${category} is missing`);
}
assert.match(html, /box_admin_rights/, 'FRITZ!Box administrator accounts must be identified in credential cards');
assert.equal(html.includes('E-Mail, MyFRITZ! &amp; eigener DynDNS'), true, 'online service cards are missing');
assert.equal(html.includes('Internetzugang &amp; AVM-Fernkonfiguration'), true, 'remote configuration cards are missing');
assert.equal(html.includes('Online-Telefonbücher'), true, 'online phonebook cards are missing');
assert.equal(html.includes('Interne Nebenstellen &amp; FRITZ!App Fon'), true, 'internal telephony cards are missing');
assert.match(html, /Registrar: \$\{registrar\}/, 'SIP cards must label the registrar explicitly');
assert.equal(html.includes("normalizedPath.includes('serialcfg')"), true, 'mobile access cards must use their structural path');
assert.equal(html.includes('Mobilfunkzugang'), true, 'mobile access cards need a descriptive title');
assert.match(html, /APN: \$\{metadata\.provider\}/, 'mobile access cards must label the APN source field');
assert.equal(html.includes('PPPoE-Internetzugang'), true, 'PPPoE access cards need a descriptive title');
assert.match(html, /Profil: \$\{metadata\.name\}/, 'PPPoE cards must expose the target profile name');
assert.equal(html.includes('TR-069 / CWMP'), true, 'remote configuration card needs an explicit title');
assert.equal(html.includes('Erreichbarkeit für Fernkonfiguration'), true, 'AVM remote DDNS needs a separate card');
assert.equal(html.includes('Interne dynamische Adresse unter acpe.avm.de'), true, 'AVM remote DDNS purpose is missing');
assert.equal(html.includes('Benutzerdefinierter DynDNS-Zugang'), true, 'independent DynDNS must stay separate from AVM services');
assert.equal(html.includes('AVM-DynDNS-Adresse und OAuth-Zugang'), true, 'MyFRITZ must be identified as its own AVM service');
assert.equal(html.includes('FRITZ!Box WireGuard-Identität'), true, 'WireGuard global key card is missing');
assert.equal(html.includes('WireGuard-Gegenstelle'), true, 'WireGuard connection card is missing');
for (const label of ['Gegenstellen-Domain', 'Lokale IP', 'Entfernte IP', 'Erlaubte Netze', 'Öffentlicher Schlüssel der Gegenstelle']) {
  assert.equal(html.includes(label), true, `WireGuard metadata ${label} is missing`);
}

console.log('UI structure regression tests passed.');
