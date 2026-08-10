'use strict';

const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

if (typeof globalThis.crypto === 'undefined') globalThis.crypto = nodeCrypto.webcrypto;
globalThis.pako = require('pako');
globalThis.CryptoJS = require('crypto-js');

const FritzOSCrypto = require('../lib/FritzOSCrypto.js');
const FritzExportChecksum = require('../lib/FritzExportChecksum.js');
const { FritzExportEditor } = require('../src/FritzExportEditor.js');
const { ConfigState } = require('../src/ConfigState.js');
const { commitMutation } = require('../src/MutationFlow.js');
const { ValidationCoordinator } = require('../src/ValidationCoordinator.js');

function createClock() {
  let nextId = 1;
  let now = 1000;
  const timeouts = new Map();
  const intervals = new Map();
  return {
    now: () => now,
    setTimeoutFn(callback) {
      const id = nextId++;
      timeouts.set(id, callback);
      return id;
    },
    clearTimeoutFn: id => timeouts.delete(id),
    setIntervalFn(callback) {
      const id = nextId++;
      intervals.set(id, callback);
      return id;
    },
    clearIntervalFn: id => intervals.delete(id),
    tick(milliseconds) {
      now += milliseconds;
      intervals.forEach(callback => callback());
    },
    async fireTimeouts() {
      const callbacks = [...timeouts.values()];
      timeouts.clear();
      await Promise.all(callbacks.map(callback => callback()));
    }
  };
}

async function run() {
  const password = 'behavior-test-password';
  const encryptedSecret = await FritzOSCrypto.AVMCrypto.encryptSecret('wlan-secret', password);
  const uncheckedExport = [
    '**** FRITZ!Box 7590 CONFIGURATION EXPORT',
    'FirmwareVersion=154.08.00',
    '**** CFGFILE: wlan.cfg',
    `pskvalue = "${encryptedSecret}";`,
    '**** END OF FILE ****',
    '**** END OF EXPORT 00000000 ****',
    ''
  ].join('\r\n');
  const originalExport = FritzExportChecksum.fromText(uncheckedExport).replaceChecksum().updatedText;
  const state = new ConfigState(FritzOSCrypto.FritzBoxParser);
  state.load(originalExport);
  const secret = state.secrets.find(item => item.field === 'pskvalue');
  state.markDecrypted(secret.id, { plaintext: 'wlan-secret', type: 4 });

  const clock = createClock();
  const validationStatuses = [];
  const verificationSteps = [];
  const coordinator = new ValidationCoordinator({
    delay: 15000,
    getSnapshot: () => ({
      changedSecrets: state.getChangedSecrets().length,
      hasUnsavedChanges: state.hasUnsavedChanges(),
      downloadReady: state.isDownloadReady()
    }),
    hasPassword: () => Boolean(password),
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    onStatus: event => validationStatuses.push(`${event.phase}:${event.seconds || event.request.kind}`),
    run: async (_request, generation) => {
      const sourceText = state.workingText;
      const ensureFresh = () => {
        if (!coordinator.isCurrent(generation) || sourceText !== state.workingText) {
          throw new Error('AUTO_VALIDATION_STALE');
        }
      };
      const result = await FritzExportEditor.verifyWorkingCopy({
        text: sourceText,
        password,
        secrets: state.secrets,
        assertFresh: ensureFresh,
        onStep: event => {
          verificationSteps.push(`${event.step}:${event.status}`);
          state.setVerificationStep(event.step, event.status, event.message);
        }
      });
      ensureFresh();
      state.setWorkingText(result.updatedText);
      state.setVerificationStep('roundtrip', 'success', 'Roundtrip erfolgreich');
      state.setVerificationStep('checksum', 'success', 'CRC32 gültig');
    }
  });

  const editedExport = state.workingText.replace('FirmwareVersion=154.08.00', 'FirmwareVersion=154.08.01');
  commitMutation(state, { kind: 'structure', workingText: editedExport });
  assert.equal(state.isDownloadReady(), false, 'editor changes must lock the download immediately');

  const request = coordinator.schedule();
  assert.equal(request.kind, 'working-copy');
  assert.equal(validationStatuses.at(-1), 'waiting:15');
  clock.tick(1000);
  assert.equal(validationStatuses.at(-1), 'waiting:14');

  await clock.fireTimeouts();
  assert.deepEqual(verificationSteps, [
    'roundtrip:running',
    'roundtrip:success',
    'checksum:running',
    'checksum:success'
  ]);
  assert.equal(state.verification.roundtrip.status, 'success');
  assert.equal(state.verification.checksum.status, 'success');
  assert.equal(FritzExportEditor.verifyExportChecksum(state.workingText).valid, true);
  assert.equal(state.isDownloadReady(), true, 'roundtrip and CRC32 must release the download');

  console.log('App state flow behavior test passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
