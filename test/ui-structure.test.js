const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
const cryptoSource = fs.readFileSync(require.resolve('../lib/FritzOSCrypto.js'), 'utf8');
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
  'viewTelephony',
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
  'sipPhoneNavCount',
  'sipPhoneStatus',
  'sipPhoneNotice',
  'sipPhoneAccount',
  'sipPhoneWebsocket',
  'btnSipConnect',
  'sipIncomingCall',
  'sipIncomingCaller',
  'btnSipAnswer',
  'btnSipDecline',
  'sipDialTarget',
  'sipSelectedContact',
  'btnSipCall',
  'btnSipHangup',
  'sipCallMessage',
  'sipContactSearch',
  'sipContactList',
  'sipRemoteAudio',
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
  'btnToggleMasterKeyRotation',
  'masterKeyRotationPanel',
  'masterKeyModeRandom',
  'masterKeyModeManual',
  'manualMasterKeyFields',
  'manualMasterKey',
  'confirmManualMasterKey',
  'masterKeyRotationPassword',
  'confirmMasterKeyRotation',
  'masterKeyRotationStatus',
  'masterKeyRotationResult',
  'btnCancelMasterKeyRotation',
  'btnRotateMasterKey',
  'downloadGateStatus',
  'roundtripCheck',
  'roundtripCheckMessage',
  'checksumCheck',
  'checksumCheckMessage',
  'reencryptSummary',
  'reencryptSummaryList',
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
  'editorContent',
  'btnEditorTheme',
  'btnNewSipAccount',
  'newSipAccountPanel',
  'newSipAccountTemplate',
  'sipSettingsDrawer',
  'sipSettingsDrawerBody',
  'sipSettingsDrawerActions'
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
assert.match(html, /FritzDecryptedEditor\.applyEdit/, 'decrypted expert edits must pass through the plaintext mapping layer');
assert.match(html, /FritzDecryptedEditor\.buildDocument/, 'decrypted expert view must be derived from encrypted state');
assert.match(html, /Original · schreibgeschützt/, 'the immutable loaded original needs an explicit view state');
assert.match(html, /this\.editorTheme === 'console'/, 'the expert editor needs an independent console/light theme toggle');
assert.match(html, /this\.validateWorkingCopy\(generation\)/, 'structural edits need automatic roundtrip and checksum validation');
assert.match(html, /this\.sipAccountsApi\.update\(group\.document, group\.structure, changes\)/, 'simple SIP settings must update the shared config document');
assert.match(html, /this\.sipAccountsApi\.clone\(group\.document, group\.structure/, 'SIP cloning must use the lossless block model');
assert.match(html, /\['registrar', 'Registrar', 'text'\]/, 'the SIP card settings need an explicit small-field allowlist');
assert.match(html, /enabled:\s*'no'/, 'cloned SIP accounts must start disabled');
assert.match(html, /initializeClonedSipSecrets\(group, result\.accountName, asNew\)/, 'new SIP drafts must inherit the decrypted template state');
assert.match(html, /this\.state\.setEditedPlaintext\(secret\.id, ''\)/, 'new SIP credentials must start as directly editable blank changes');
assert.match(html, /Zugangsdaten der gewählten Vorlage zuerst entschlüsseln/, 'new SIP drafts must require a decrypted template');
assert.match(html, /inset-y-0 right-0[\s\S]*max-w-xl/, 'desktop SIP settings must use a right-side drawer');
assert.match(html, /sipSettingsDrawerBody[\s\S]*overflow-y-auto/, 'the SIP settings drawer body must scroll independently');
assert.match(html, /sipSettingsDrawerActions[\s\S]*shrink-0/, 'drawer actions must remain visible below the scroll area');
assert.match(html, /FritzWireGuardConnections\.js\?v=\d{8}-\d+/, 'WireGuard projection needs a deployment cache key');
assert.match(html, /tweetnacl@1\.0\.3\/nacl-fast\.min\.js/, 'TweetNaCl must be loaded from the pinned browser CDN dependency');
assert.match(html, /lib\/FritzWireGuardKeys\.js\?v=\d{8}-\d+/, 'WireGuard key adapter needs a deployment cache key');
assert.match(html, /this\.wireGuardKeys\.derivePublicKey\(privateKeyChange\.editedPlaintext\)/, 'private key edits must derive the matching public key');
assert.match(html, /this\.wireGuardApi\.update\(documentModel, model\.global, \{ wg_public_key: publicKey \}\)/, 'only the global WireGuard public key may be updated');
assert.match(html, /transformText,/, 'linked public-key changes must stay inside the atomic export transaction');
assert.equal(html.includes('muss danach aber in allen Gegenstellen aktualisiert werden'), true, 'private-key edits require a peer update warning');
assert.match(html, /this\.wireGuardApi\.project\(document\)/, 'WireGuard cards must use the lossless document projection');
assert.match(html, /this\.wireGuardApi\.update\(documentModel, connection, changes\)/, 'WireGuard settings must update the shared config document');
assert.match(html, /renderWireGuardCards\(vpnSecrets, wireGuardProjection\)/, 'VPN secrets must render through complete WireGuard connection cards');
assert.match(html, /\['wg_dyndns', 'Endpoint \/ Domain', 'text'\]/, 'WireGuard simple settings must expose the endpoint');
assert.match(html, /\['wg_allowed_ips', 'Erlaubte Netze', 'text'\]/, 'WireGuard simple settings must expose allowed networks');
assert.match(html, /connection\.fields\.dns_servers[\s\S]*connection\.fields\.wg_dnsserver/, 'WireGuard settings must support v4 and v3 DNS field names');
assert.match(html, /connection\.values\.wg_slave_network[\s\S]*connection\.values\.wg_slave_mask/, 'WireGuard cards must support v3 peer network fields');
const wireGuardCardDetails = html.match(/this\.appendWireGuardDetails\(card, \[\s*\['Erlaubte Netze'[\s\S]*?\]\);/)?.[0] || '';
assert.match(wireGuardCardDetails, /Erlaubte Netze/, 'WireGuard cards must keep allowed networks visible');
assert.match(wireGuardCardDetails, /DNS-Server/, 'WireGuard cards must keep DNS servers visible');
for (const hiddenDetail of ['Endpoint / Domain', 'Lokale IP', 'Entfernte IP', 'Gegenstellen-Netz', 'Persistent Keepalive']) {
  assert.equal(wireGuardCardDetails.includes(hiddenDetail), false, `${hiddenDetail} belongs in the WireGuard settings drawer`);
}
assert.match(html, /technicalTitle\.textContent = 'Technische Werte'/, 'hidden WireGuard connection details must remain available in the drawer');
assert.match(html, /this\.jumpToEditorLine\(secret\.line\)/, 'secret location links must navigate to the exact source line');
assert.equal((html.match(/this\.createSecretLocationLink\(secret/g) || []).length >= 5, true, 'secret list, audit and credential cards must expose source links');
assert.equal(html.includes('<Binärer Master-Key (entschlüsselt)>'), false, 'master key placeholder must not hide the actual decrypted key');
assert.equal(cryptoSource.includes('System-Master-Key'), false, 'the misleading system master key label must not return');
assert.equal(cryptoSource.includes('Export-Master-Key'), true, 'the export master key needs its precise label');
assert.match(html, /exportSafetyPanel[\s\S]*exportMasterKeySection[\s\S]*credentialCards/, 'export master key card must appear between export safety and credential cards');
assert.match(html, /this\.isExportMasterKey\(secret\) \? this\.exportMasterKeyCard : this\.secretEditorList/, 'export master key must render in its dedicated top card');
assert.equal(cryptoSource.includes('encryptExportKey'), true, 'crypto library must support rewrapping the export master key');
assert.equal(html.includes('Kennwort ändern und prüfen'), true, 'password change needs one explicit verified action');
assert.equal(html.includes('Der Export-Master-Key selbst wird nicht verändert.'), true, 'password change UI must explain that the master key is preserved');
assert.match(html, /const editable = supported && !this\.isExportMasterKey\(secret\)/, 'the export master key itself must stay read-only');
assert.match(html, /this\.exportEditor\.changeExportPassword\(/, 'password changes must delegate to the atomic export service');
assert.match(html, /newPassword !== confirmation/, 'the new export password must be confirmed');
assert.match(html, /src\/FritzExportEditor\.js\?v=20260809-1/, 'export editing service needs the current deployment cache key');
assert.match(html, /typeof window\.FritzExportEditor\?\.FritzExportEditor\?\.changeExportPassword/, 'partial deployments must reject a missing password change service');
assert.equal(cryptoSource.includes('generateExportKey'), true, 'crypto library must expose secure export key generation');
assert.match(cryptoSource, /getRandomValues\(new Uint8Array\(16\)\)/, 'random master keys must come from the operating system CSPRNG');
assert.equal(cryptoSource.includes('Math.random'), false, 'master key generation must never fall back to Math.random');
assert.equal(html.includes('Sicher erzeugen'), true, 'secure random master key generation must be the recommended UI choice');
assert.equal(html.includes('Der Export-Master-Key wird wirklich ersetzt'), true, 'master key rotation needs an explicit warning');
assert.match(html, /\^\[0-9a-fA-F\]\{32\}\$/, 'manual master keys must contain exactly 32 hexadecimal characters');
assert.match(html, /manualKey\.toLowerCase\(\) !== confirmation\.toLowerCase\(\)/, 'manual master keys must be confirmed');
assert.match(html, /this\.exportEditor\.rotateExportMasterKey\(/, 'master key rotation must delegate to the atomic export service');
assert.match(html, /this\.state\.markDecrypted\(masterSecret\.id,[\s\S]*plaintext: result\.newExportKeyHex/, 'the UI state must expose the newly rotated master key');
assert.equal(html.includes('exportKeyHex.substring'), false, 'master key material must not be written to the technical log');
assert.match(html, /typeof window\.FritzExportEditor\?\.FritzExportEditor\?\.rotateExportMasterKey/, 'partial deployments must reject a missing rotation service');
assert.match(html, /plaintext:\s*mkResult\.exportKeyHex/, 'decrypted master key must be available to the masked secret field');
assert.match(html, /input\.type\s*=\s*this\.revealedSecrets\.has\(secret\.stableKey\)\s*\?\s*'text'\s*:\s*'password'/, 'plaintext fields must be masked by default');
for (const action of ['Anzeigen', 'Kopieren', 'Bearbeiten', 'Zurücksetzen']) {
  assert.equal(html.includes(`'${action}'`), true, `secret action ${action} is missing`);
}
assert.equal(html.includes('Alle anzeigen'), true, 'global reveal action is missing');
assert.equal(html.includes('Alle verbergen'), true, 'global hide action is missing');
assert.equal(html.includes('In Zwischenablage kopieren'), true, 'SIP clipboard action is missing');
const cardEditor = html.match(/createMaskedCredential\(secret, options = \{\}\)\s*\{[\s\S]*?(?=\n\s*isWifiPasswordSecret\()/)?.[0] || '';
assert.match(cardEditor, /createCredentialAction\('', 'pencil'/, 'credential cards need a direct edit action');
assert.match(cardEditor, /createCredentialAction\('', 'undo-2'/, 'credential cards need a per-field reset action');
assert.match(cardEditor, /if \(editInInputRow\) inputRow\.appendChild\(edit\)/, 'credential card edit actions belong next to the reveal action by default');
assert.match(html, /createMaskedCredential\(secret, \{ editInInputRow: false \}\)/, 'WLAN cards need their edit action on the second row');
assert.match(html, /credential\.querySelector\('\[data-credential-actions\]'\)\?\.append\(copyPassword\)/, 'the WLAN edit action must remain left of the copy action');
assert.match(cardEditor, /this\.commitMutation\([\s\S]*kind: 'secret'[\s\S]*secretId: secret\.id/, 'card edits must use the shared mutation flow');
assert.equal(cardEditor.includes('this.scheduleAutoValidation()'), false, 'card handlers must not schedule validation outside the mutation flow');
assert.match(cardEditor, /this\.syncSecretEditorRow\(secret\)/, 'card edits must keep the detailed secret row synchronized');
const expertEditorInput = html.match(/handleEditorInput\(\)\s*\{[\s\S]*?(?=\n\s*switchView\()/)?.[0] || '';
assert.equal(
  (expertEditorInput.match(/this\.commitMutation\(/g) || []).length,
  2,
  'both decrypted and structural expert-editor changes must use the shared mutation pipeline'
);
assert.equal(
  expertEditorInput.includes('this.cancelAutoValidation()'),
  false,
  'expert-editor input must not cancel its own pending validation'
);
const configMutation = html.match(/commitMutation\(mutation, options = \{\}\)\s*\{[\s\S]*?(?=\n\s*switchView\()/)?.[0] || '';
assert.match(configMutation, /this\.mutationFlow\.commitMutation\(this\.state, mutation\)/, 'all app mutations must delegate state changes to the shared mutation service');
assert.match(configMutation, /result\.keepPreviewVisible[\s\S]*this\.renderPreviewText/, 'structural edits must preserve the decrypted editor view');
assert.match(configMutation, /this\.renderState\(\);[\s\S]*this\.scheduleAutoValidation\(\)/, 'state rendering must complete before validation is scheduled');
assert.match(html, /applyStructuredConfigText\(updatedText, message, afterStateUpdate = null\)[\s\S]*this\.commitMutation\(/, 'structured card settings must use the shared mutation pipeline');
const changeStateRender = html.match(/renderChangeState\(\)\s*\{[\s\S]*?(?=\n\s*clearAll\()/)?.[0] || '';
assert.equal(changeStateRender.includes('autoValidation'), false, 'rendering the change state must not mutate validation scheduling');
assert.equal(changeStateRender.includes('setAutoValidationStatus'), false, 'rendering must not overwrite validation status');
assert.equal(/href\s*=\s*["']sip:/i.test(html), false, 'SIP cards must not launch a softphone');
assert.equal(html.includes('qrcode_UTF8.js'), true, 'UTF-8 QR encoding support is missing');
assert.match(html, /this\.btnSave\.disabled\s*=\s*!ready/, 'download button must follow the verification gate');
assert.match(html, /this\.state\.isDownloadReady\(\)/, 'download handler must verify both safety checks');
assert.equal(html.includes('1. Secret-Roundtrip'), true, 'roundtrip verification step is missing');
assert.equal(html.includes('2. CRC32-Prüfung'), true, 'checksum verification step is missing');
assert.equal(html.includes('Ungespeicherte Änderungen'), true, 'unsaved changes indicator is missing');
assert.equal(html.includes('Originaldatei wiederherstellen?'), true, 'original restore flow is missing');
assert.match(html, /src\/MutationFlow\.js\?v=\d{8}-\d+/, 'mutation flow needs a deployment cache key');
assert.equal(html.includes('MutationFlow API v1'), true, 'mutation flow compatibility guard is missing');
assert.match(html, /src\/ValidationCoordinator\.js\?v=\d{8}-\d+/, 'validation coordinator needs a deployment cache key');
assert.match(html, /new window\.FritzValidationCoordinator\.ValidationCoordinator\(\{[\s\S]*delay:\s*15000/, 'automatic validation must wait for a typing pause');
assert.match(html, /request\.kind === 'secrets'[\s\S]*this\.reencryptChangedSecrets\(generation\)[\s\S]*this\.validateWorkingCopy\(generation\)/, 'the coordinator must dispatch secret and structural validation');
assert.equal(html.includes('ValidationCoordinator API v1'), true, 'validation coordinator compatibility guard is missing');
assert.equal(html.includes('Jetzt neu verschlüsseln und prüfen'), false, 'manual double-confirmation must not return');
assert.match(html, /<details id="reencryptSummary"/, 'change overview must be collapsible');
assert.ok(
  html.indexOf('id="exportSafetyPanel"') < html.indexOf('id="reencryptSummary"') &&
  html.indexOf('id="reencryptSummary"') < html.indexOf('id="exportMasterKeySection"'),
  'change overview must sit below download verification and above master-key protection'
);
assert.match(html, /<main class="min-w-0 space-y-5">\s*<section id="exportSafetyPanel"[\s\S]*?<section id="viewOverview"/, 'download verification must remain visible on every workspace page');
assert.equal(html.includes('Strukturänderungen und verschlüsselte Werte wurden geprüft. Der Download ist freigegeben.'), true, 'successful automatic validation must remain visible in export safety');
assert.match(html, /markReencrypted\(/, 'validated changes must retain their audit state');
assert.equal(html.includes('Geändert · validiert'), true, 'validated change label is missing');
assert.match(html, /src\/ConfigState\.js\?v=\d{8}-\d+/, 'local state script must load from src with a deployment cache key');
assert.equal(html.includes("ConfigState API v2"), true, 'state compatibility guard is missing');
assert.equal(html.includes('Die Programmdateien wurden nicht gemeinsam aktualisiert.'), true, 'partial deployment must fail with a useful message');
assert.match(html, /src\/FritzExportEditor\.js\?v=\d{8}-\d+/, 'atomic export editor must load from src with a deployment cache key');
assert.equal(html.includes('FritzExportEditor API v1'), true, 'export editor compatibility guard is missing');
assert.match(html, /src\/FritzEmbeddedFiles\.js\?v=\d{8}-\d+/, 'embedded file decoder must load from src with a deployment cache key');
assert.equal(html.includes('FritzEmbeddedFiles API v1'), true, 'embedded file decoder compatibility guard is missing');
assert.match(html, /src\/FritzSipWebPhone\.js\?v=\d{8}-\d+/, 'SIP webphone service must load from src with a deployment cache key');
assert.match(html, /src\/SipWebPhoneProviders\.js\?v=\d{8}-\d+/, 'generated SIP provider table must load from src with a deployment cache key');
assert.match(html, /window\.FritzSipProviderTable\?\.schemaVersion !== '1'/, 'partial deployments must reject a missing provider table');
assert.equal(html.includes('FritzSipWebPhone API v1'), true, 'SIP webphone compatibility guard is missing');
assert.equal(html.includes('cdnjs.cloudflare.com/ajax/libs/sip.js/0.20.0/sip.min.js'), true, 'browser SIP stack is missing');
assert.equal(html.includes('Aktuell wird nur Sipgate automatisch unterstützt'), true, 'webphone must communicate its provider allowlist');
assert.equal(html.includes('Im Webphone verwenden'), true, 'compatible SIP cards need a webphone handoff');
assert.match(html, /this\.sipWebPhoneApi\.createCompatibleAccount/, 'UI must delegate WSS provider matching to the webphone service');
assert.match(html, /this\.renderSipPhoneAccounts\(sipSecrets\)/, 'decrypted SIP accounts must refresh the webphone');
assert.match(html, /this\.renderSipPhoneContacts\(\)/, 'embedded phonebooks must feed the phone contact picker');
assert.match(html, /this\.sipDialTarget\.value = contact\.number/, 'contact selection must only prepare the dial target');
assert.equal(/button\.addEventListener\('click',[\s\S]{0,200}sipPhone\.call\(contact/.test(html), false, 'selecting a contact must never place a call immediately');
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
