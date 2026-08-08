const assert = require('node:assert/strict');
const FritzExportChecksum = require('../lib/FritzExportChecksum.js');

const standardVector = new TextEncoder().encode('123456789');
assert.equal(
  FritzExportChecksum.crc32(standardVector).toString(16).toUpperCase(),
  'CBF43926',
  'CRC32 implementation must match the standard test vector'
);

const exportText = [
  '**** FRITZ!Box 7590 CONFIGURATION EXPORT',
  'Password=abc',
  'FirmwareVersion=154.08.00',
  '**** CFGFILE: test.cfg',
  'first line',
  'last line',
  '**** END OF FILE ****',
  '**** BINFILE: bin.dat',
  '00FF10',
  '**** END OF FILE ****',
  '**** B64FILE: b64.dat',
  'AQIDBA==',
  '**** END OF FILE ****',
  '**** END OF EXPORT 00000000 ****',
  ''
].join('\r\n');

const calculated = FritzExportChecksum.fromText(exportText).calculate();
assert.deepEqual(calculated, { oldCrc: '00000000', newCrc: 'C9DEDEAD' });

const replaced = FritzExportChecksum.fromText(exportText).replaceChecksum();
assert.match(replaced.updatedText, /END OF EXPORT C9DEDEAD/);
assert.equal(replaced.updatedText.includes('\r\n'), true, 'line endings must be preserved');

const verified = FritzExportChecksum.fromText(replaced.updatedText).calculate();
assert.equal(verified.oldCrc, verified.newCrc, 'updated export checksum must verify');

assert.throws(
  () => FritzExportChecksum.fromText('**** FRITZ!Box CONFIGURATION EXPORT\n').calculate(),
  /END OF EXPORT/,
  'incomplete exports must be rejected'
);

console.log('FritzExportChecksum regression tests passed.');
