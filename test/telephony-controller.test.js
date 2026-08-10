const assert = require('node:assert/strict');
const { API_VERSION, TelephonyController } = require('../src/TelephonyController.js');

assert.equal(API_VERSION, '1');

(async () => {
  const actions = [];
  let trackStopped = false;
  const controller = new TelephonyController({
    phone: {
      connect: async account => actions.push(['connect', account.id]),
      disconnect: async () => actions.push(['disconnect']),
      call: async target => actions.push(['call', target]),
      answer: async () => actions.push(['answer']),
      hangup: async () => actions.push(['hangup'])
    },
    mediaDevices: {
      getUserMedia: async constraints => {
        actions.push(['media', constraints]);
        return { getTracks: () => [{ stop: () => { trackStopped = true; } }] };
      }
    }
  });

  controller.setAccounts([{ id: 'sipgate' }]);
  assert.equal(controller.getAccount('sipgate').id, 'sipgate');
  assert.equal(await controller.toggleConnection(controller.getAccount('sipgate')), 'connected');
  controller.setPhoneState('registered');
  assert.equal(controller.isRegistered(), true);
  assert.equal(await controller.toggleConnection(controller.getAccount('sipgate')), 'disconnected');

  await controller.call('0123');
  await controller.answer();
  await controller.hangup();
  assert.equal(trackStopped, true);
  assert.deepEqual(actions.map(action => action[0]), [
    'connect', 'disconnect', 'media', 'call', 'media', 'answer', 'hangup'
  ]);

  const contact = { name: 'Ada', number: '+49 123 456789' };
  assert.equal(controller.findContact([contact], '0049-123-456789'), contact);
  controller.selectContact(contact);
  assert.equal(controller.selectedContact, contact);
  controller.clearSelectedContact();
  assert.equal(controller.selectedContact, null);

  controller.reset();
  assert.deepEqual(controller.getAccounts(), []);
  assert.equal(controller.getPhoneState(), 'idle');

  await assert.rejects(
    () => new TelephonyController({ phone: {} }).requestMicrophone(),
    /Mikrofonzugriff/
  );
  assert.throws(() => new TelephonyController(), /phone is required/);

  console.log('TelephonyController tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
