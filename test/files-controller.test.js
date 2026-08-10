const assert = require('node:assert/strict');
const { API_VERSION, FilesController } = require('../src/FilesController.js');

assert.equal(API_VERSION, '1');

let extractedText = null;
const controller = new FilesController({
  extractPhonebooks(text) {
    extractedText = text;
    return {
      files: [{ name: 'phonebook' }],
      phonebookFiles: [{ name: 'phonebook' }],
      books: [{
        name: 'Telefonbuch',
        contacts: [{
          name: 'Ada',
          numbers: [
            { value: '0123', type: 'work' },
            { value: '', type: 'home' }
          ]
        }]
      }],
      errors: []
    };
  }
});

const loaded = controller.load('export text');
assert.equal(extractedText, 'export text');
assert.equal(controller.getData(), loaded, 'the controller owns one canonical file model');
assert.deepEqual(controller.getPhoneContacts(), [{
  name: 'Ada',
  number: '0123',
  type: 'work',
  book: 'Telefonbuch'
}]);

controller.reset();
assert.deepEqual(controller.getData(), { files: [], phonebookFiles: [], books: [], errors: [] });
assert.deepEqual(controller.getPhoneContacts(), []);

assert.throws(() => new FilesController(), /extractPhonebooks is required/);

console.log('FilesController tests passed.');
