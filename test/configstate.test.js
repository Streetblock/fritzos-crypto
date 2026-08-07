const assert = require('node:assert/strict');
const { ConfigState, API_VERSION } = require('../ConfigState.js');

assert.equal(API_VERSION, '2', 'browser and state module must share an explicit API version');

const parser = {
  extractSecrets(text) {
    return [...new Set(String(text).match(/\$\$\$\$[A-Za-z0-9./+=_-]+/g) || [])];
  }
};

const first = '$$$$AAAA1111';
const second = '$$$$BBBB2222==';
const state = new ConfigState(parser);

state.load(`Password=${first}\nsecret="${second}"`);
assert.deepEqual(state.getCounts(), { total: 2, pending: 2, decrypted: 0, failed: 0, changed: 0 });
assert.equal(state.hasUnsavedChanges(), false);
assert.equal(state.isDownloadReady(), false);

state.markDecrypted(first, { plaintext: '<master>' });
state.markDecrypted(second, { plaintext: 'cleartext' });
state.markFailed(second, new Error('BAD_PASSWORD'));
const replaceAtOccurrence = (text, secret, plaintext) =>
  text.slice(0, secret.start) + plaintext + text.slice(secret.end);
const preview = state.createPreview(replaceAtOccurrence);
assert.match(preview, /cleartext/);
assert.equal(state.workingText.includes(second), true, 'working copy must retain encrypted values');
assert.deepEqual(state.getCounts(), { total: 2, pending: 0, decrypted: 2, failed: 0, changed: 0 });
assert.equal(state.getDecryptableSecrets().length, 0, 'already decrypted plaintext must not be decrypted again');

state.setEditedPlaintext(second, 'changed cleartext');
assert.equal(state.getChangedSecrets().length, 1, 'edited plaintext must be tracked separately');
assert.equal(state.hasUnsavedChanges(), true);
assert.match(state.createPreview(replaceAtOccurrence), /changed cleartext/);
assert.equal(state.getCounts().changed, 1);
state.setEditedPlaintext(second, 'cleartext');
assert.equal(state.getChangedSecrets().length, 0, 'restoring plaintext must clear the changed state');
assert.equal(state.hasUnsavedChanges(), false);

state.setEditedPlaintext(second, 'validated cleartext');
state.markReencrypted(second, { plaintext: 'validated cleartext', type: 4 }, 'cleartext');
assert.equal(state.getChangedSecrets().length, 0, 'validated changes must not remain pending');
assert.equal(state.getModifiedSecrets().length, 1, 'validated changes must remain visible in the audit');
assert.equal(state.getSecret(second).validatedChange, true);
assert.equal(state.getSecret(second).previousPlaintext, 'cleartext');
assert.equal(state.getCounts().changed, 1);

state.setVerificationStep('roundtrip', 'success', '2 Secrets geprüft');
state.setVerificationStep('checksum', 'success', 'CRC32 geprüft');
assert.equal(state.isDownloadReady(), true, 'both successful checks must unlock downloads');

state.showWorkingCopy();
state.setWorkingText(`${state.workingText}\nthird="$$$$CCCC3333"`);
assert.equal(state.isDownloadReady(), false, 'working-copy edits must invalidate prior checks');
assert.equal(state.hasUnsavedChanges(), true);
assert.deepEqual(state.getCounts(), { total: 3, pending: 1, decrypted: 2, failed: 0, changed: 1 });

state.markFailed('$$$$CCCC3333', new Error('BAD_PASSWORD'));
assert.equal(state.workingText.includes(second), true, 'a failed attempt must not destroy the working copy');
assert.deepEqual(state.getCounts(), { total: 3, pending: 0, decrypted: 2, failed: 1, changed: 1 });
assert.equal(state.getDecryptableSecrets().length, 1, 'failed secrets must be retryable');

state.markDecrypted('$$$$CCCC3333', { plaintext: 'retried' });
assert.deepEqual(state.getCounts(), { total: 3, pending: 0, decrypted: 3, failed: 0, changed: 1 });

state.setVerificationStep('roundtrip', 'success');
state.setVerificationStep('checksum', 'success');
assert.equal(state.markDownloaded(), true);
assert.equal(state.hasUnsavedChanges(), false, 'successful download must clear the unsaved indicator');

assert.equal(state.restoreOriginal(), `Password=${first}\nsecret="${second}"`);
assert.equal(state.hasUnsavedChanges(), true, 'restoring after a modified download creates a new unsaved state');
assert.equal(state.getCounts().total, 2);
assert.equal(state.isDownloadReady(), false, 'restored originals require fresh validation before download');

state.load(`replacement="${second}"`);
assert.equal(state.originalText, `replacement="${second}"`);
assert.deepEqual(state.getCounts(), { total: 1, pending: 1, decrypted: 0, failed: 0, changed: 0 }, 'loading another file must reset results');

console.log('ConfigState regression tests passed.');
