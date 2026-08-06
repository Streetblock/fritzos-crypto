const assert = require('node:assert/strict');
const { ConfigState } = require('../ConfigState.js');

const parser = {
  extractSecrets(text) {
    return [...new Set(String(text).match(/\$\$\$\$[A-Za-z0-9./+=_-]+/g) || [])];
  }
};

const first = '$$$$AAAA1111';
const second = '$$$$BBBB2222==';
const state = new ConfigState(parser);

state.load(`Password=${first}\nsecret="${second}"`);
assert.deepEqual(state.getCounts(), { total: 2, pending: 2, decrypted: 0, failed: 0 });

state.markDecrypted(first, { plaintext: '<master>' });
state.markDecrypted(second, { plaintext: 'cleartext' });
state.markFailed(second, new Error('BAD_PASSWORD'));
const preview = state.createPreview((text, secret, plaintext) => text.replace(secret, plaintext));
assert.match(preview, /cleartext/);
assert.equal(state.workingText.includes(second), true, 'working copy must retain encrypted values');
assert.deepEqual(state.getCounts(), { total: 2, pending: 0, decrypted: 2, failed: 0 });
assert.equal(state.getDecryptableSecrets().length, 0, 'already decrypted plaintext must not be decrypted again');

state.showWorkingCopy();
state.setWorkingText(`${state.workingText}\nthird="$$$$CCCC3333"`);
assert.deepEqual(state.getCounts(), { total: 3, pending: 1, decrypted: 2, failed: 0 });

state.markFailed('$$$$CCCC3333', new Error('BAD_PASSWORD'));
assert.equal(state.workingText.includes(second), true, 'a failed attempt must not destroy the working copy');
assert.deepEqual(state.getCounts(), { total: 3, pending: 0, decrypted: 2, failed: 1 });
assert.equal(state.getDecryptableSecrets().length, 1, 'failed secrets must be retryable');

state.markDecrypted('$$$$CCCC3333', { plaintext: 'retried' });
assert.deepEqual(state.getCounts(), { total: 3, pending: 0, decrypted: 3, failed: 0 });

state.load(`replacement="${second}"`);
assert.equal(state.originalText, `replacement="${second}"`);
assert.deepEqual(state.getCounts(), { total: 1, pending: 1, decrypted: 0, failed: 0 }, 'loading another file must reset results');

console.log('ConfigState regression tests passed.');
