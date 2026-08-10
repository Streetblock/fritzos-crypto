'use strict';

const assert = require('node:assert/strict');
const { API_VERSION, SecretController } = require('../src/SecretController.js');

const mutations = [];
const controller = new SecretController({
  commitMutation: (mutation, options) => {
    mutations.push({ mutation, options });
    return mutation;
  }
});
const secret = {
  id: 'secret-1',
  stableKey: 'stable-1',
  status: 'decrypted',
  plaintext: 'old',
  editedPlaintext: 'old',
  validatedChange: false,
  category: 'wlan',
  displayLabel: 'WLAN-Schlüssel'
};

assert.equal(API_VERSION, '1');
assert.equal(controller.getDisplayStatus(secret), 'decrypted');
secret.editedPlaintext = 'new';
assert.equal(controller.getDisplayStatus(secret), 'changed');
assert.equal(controller.getStatusLabel(secret), 'Geändert');
secret.editedPlaintext = 'old';
secret.validatedChange = true;
assert.equal(controller.getDisplayStatus(secret), 'changed');
assert.equal(controller.getStatusLabel(secret), 'Geändert · validiert');

assert.equal(controller.isRevealed(secret), false);
assert.equal(controller.toggleReveal(secret), true);
assert.equal(controller.isRevealed(secret), true);
controller.clearRevealed();
assert.equal(controller.isRevealed(secret), false);

const second = { ...secret, id: 'secret-2', stableKey: 'stable-2' };
controller.toggleAll([secret, second]);
assert.equal(controller.isRevealed(secret), true);
assert.equal(controller.isRevealed(second), true);
controller.toggleAll([secret, second]);
assert.equal(controller.isRevealed(secret), false);

assert.deepEqual(controller.filter([secret, second], {
  query: 'wlan',
  category: 'wlan',
  status: 'changed',
  getSearchText: item => item.displayLabel.toLocaleLowerCase('de')
}), [secret, second]);

controller.edit(secret, 'edited', { render: 'edit' });
controller.reset(secret, { render: 'reset' });
assert.deepEqual(mutations, [
  {
    mutation: { kind: 'secret', secretId: 'secret-1', plaintext: 'edited' },
    options: { render: 'edit' }
  },
  {
    mutation: { kind: 'secret', secretId: 'secret-1', plaintext: 'old' },
    options: { render: 'reset' }
  }
]);

console.log('Secret controller tests passed.');
