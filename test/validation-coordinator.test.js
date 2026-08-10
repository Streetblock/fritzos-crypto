'use strict';

const assert = require('node:assert/strict');
const {
  API_VERSION,
  ValidationCoordinator,
  selectValidationRequest
} = require('../src/ValidationCoordinator.js');

function createClock() {
  let nextId = 1;
  let now = 1000;
  const timeouts = new Map();
  const intervals = new Map();
  return {
    now: () => now,
    setTimeoutFn(callback, delay) {
      const id = nextId++;
      timeouts.set(id, { callback, delay });
      return id;
    },
    clearTimeoutFn: id => timeouts.delete(id),
    setIntervalFn(callback, delay) {
      const id = nextId++;
      intervals.set(id, { callback, delay });
      return id;
    },
    clearIntervalFn: id => intervals.delete(id),
    advance(milliseconds) {
      now += milliseconds;
      intervals.forEach(entry => entry.callback());
    },
    fireTimeouts() {
      const pending = [...timeouts.values()];
      timeouts.clear();
      pending.forEach(entry => entry.callback());
    },
    get timeoutCount() { return timeouts.size; },
    get intervalCount() { return intervals.size; }
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

async function run() {
  assert.equal(API_VERSION, '1');
  assert.deepEqual(selectValidationRequest({ changedSecrets: 2 }), { kind: 'secrets', changedSecrets: 2 });
  assert.deepEqual(
    selectValidationRequest({ changedSecrets: 0, hasUnsavedChanges: true, downloadReady: false }),
    { kind: 'working-copy', changedSecrets: 0 }
  );
  assert.deepEqual(
    selectValidationRequest({ changedSecrets: 0, hasUnsavedChanges: true, downloadReady: true }),
    { kind: 'none', changedSecrets: 0, verified: true }
  );

  const clock = createClock();
  const statuses = [];
  const runs = [];
  let snapshot = { changedSecrets: 0, hasUnsavedChanges: true, downloadReady: false };
  let passwordAvailable = true;
  const coordinator = new ValidationCoordinator({
    delay: 15000,
    getSnapshot: () => snapshot,
    hasPassword: () => passwordAvailable,
    run: async (request, generation) => runs.push({ request, generation }),
    onStatus: status => statuses.push(status),
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn
  });

  const structuralRequest = coordinator.schedule();
  assert.equal(structuralRequest.kind, 'working-copy');
  assert.equal(statuses.at(-1).phase, 'waiting');
  assert.equal(statuses.at(-1).seconds, 15);
  assert.equal(clock.timeoutCount, 1);
  assert.equal(clock.intervalCount, 1);

  clock.advance(5000);
  assert.equal(statuses.at(-1).seconds, 10);
  clock.fireTimeouts();
  await flushAsyncWork();
  assert.equal(runs.length, 1);
  assert.equal(runs[0].request.kind, 'working-copy');
  assert.equal(coordinator.running, false);
  assert.equal(clock.intervalCount, 0);

  snapshot = { changedSecrets: 1, hasUnsavedChanges: true, downloadReady: false };
  coordinator.schedule();
  assert.equal(clock.timeoutCount, 1);
  const pendingGeneration = coordinator.generation;
  coordinator.cancel();
  assert.equal(coordinator.generation, pendingGeneration + 1);
  assert.equal(clock.timeoutCount, 0);
  assert.equal(clock.intervalCount, 0);

  passwordAvailable = false;
  coordinator.schedule();
  assert.equal(statuses.at(-1).phase, 'blocked');
  assert.equal(clock.timeoutCount, 0);

  passwordAvailable = true;
  snapshot = { changedSecrets: 0, hasUnsavedChanges: false, downloadReady: false };
  coordinator.schedule();
  assert.equal(statuses.at(-1).phase, 'idle');

  snapshot = { changedSecrets: 0, hasUnsavedChanges: true, downloadReady: true };
  coordinator.schedule();
  assert.equal(statuses.at(-1).phase, 'verified');

  let timerCalls = 0;
  function receiverFreeTimer() {
    assert.equal(this, undefined, 'timer adapters must not be invoked as coordinator methods');
    timerCalls += 1;
    return timerCalls;
  }
  function receiverFreeClear() {
    assert.equal(this, undefined, 'timer cleanup adapters must not be invoked as coordinator methods');
  }
  const receiverSafeCoordinator = new ValidationCoordinator({
    delay: 10,
    getSnapshot: () => ({ changedSecrets: 0, hasUnsavedChanges: true, downloadReady: false }),
    run: async () => {},
    setTimeoutFn: receiverFreeTimer,
    clearTimeoutFn: receiverFreeClear,
    setIntervalFn: receiverFreeTimer,
    clearIntervalFn: receiverFreeClear
  });
  receiverSafeCoordinator.schedule();
  assert.equal(timerCalls, 2);
  receiverSafeCoordinator.cancel();

  console.log('Validation coordinator behavior tests passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
