const assert = require('node:assert/strict');
const FritzEmbeddedFiles = require('../FritzEmbeddedFiles.js');

const xml = '<?xml version="1.0" encoding="utf-8"?>' +
  '<phonebooks><phonebook name="Familie &amp; Freunde"><contact><category>Privat</category>' +
  '<person><realName>Alice &amp; Bob</realName></person><telephony nid="2">' +
  '<number type="home" prio="1" id="0">01234</number><number type="mobile" id="1">0170</number>' +
  '</telephony><mod_time>1712571067</mod_time><uniqueid>42</uniqueid></contact></phonebook>' +
  '<phonebook owner="255"><contact><person><realName>Alle (Rundruf)</realName></person>' +
  '<telephony><number type="intern" id="0">9</number></telephony><uniqueid>3</uniqueid></contact></phonebook>' +
  '<uniqueid>99</uniqueid></phonebooks>';
const midpoint = Math.floor(xml.length / 2);
const encodedLines = [xml.slice(0, midpoint), xml.slice(midpoint)].map(part => Buffer.from(part, 'utf8').toString('base64'));
const source = [
  '**** FRITZ!Box 7590 CONFIGURATION EXPORT',
  '**** B64FILE:phonebook',
  ...encodedLines,
  '**** END OF FILE ****',
  '**** END OF EXPORT 00000000 ****',
  ''
].join('\r\n');

const result = FritzEmbeddedFiles.extractPhonebooks(source);
assert.equal(FritzEmbeddedFiles.API_VERSION, '1');
assert.equal(result.errors.length, 0);
assert.equal(result.phonebookFiles.length, 1);
assert.equal(result.phonebookFiles[0].line, 2);
assert.equal(result.books.length, 2);
assert.equal(result.books[0].name, 'Familie & Freunde');
assert.equal(result.books[0].contacts.length, 1);
assert.equal(result.books[0].contacts[0].name, 'Alice & Bob');
assert.equal(result.books[0].contacts[0].category, 'Privat');
assert.deepEqual(result.books[0].contacts[0].numbers.map(number => [number.type, number.value]), [
  ['home', '01234'],
  ['mobile', '0170']
]);
assert.equal(result.books[1].name, 'Interne Ziele');
assert.equal(result.books[1].owner, '255');
assert.equal(result.books[1].contacts[0].numbers[0].type, 'intern');
assert.equal(typeof FritzEmbeddedFiles.updatePhonebook, 'undefined', 'first version must remain read-only');

console.log('Embedded phonebook file tests passed.');
