import test from 'node:test';
import assert from 'node:assert/strict';
import { BackendAvailabilityTracker, isInfrastructureFailure } from '../src/services/backendAvailability';

test('infrastructure failures include Cloudflare tunnel errors but not validation errors', () => {
  assert.equal(isInfrastructureFailure(Object.assign(new Error('Cloudflare error 1033'), { status: 530 })), true);
  assert.equal(isInfrastructureFailure(Object.assign(new Error('invalid recipient'), { status: 422 })), false);
  assert.equal(isInfrastructureFailure(new Error('invalid recipient')), false);
  assert.equal(isInfrastructureFailure(Object.assign(new TypeError('Failed to fetch'), { status: 0 })), true);
});

test('identical reads coalesce and the circuit opens for transport failures', async () => {
  const tracker = new BackendAvailabilityTracker();
  let calls = 0;
  const operation = () => tracker.run('servers', async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return ['ok'];
  });
  const [a, b] = await Promise.all([operation(), operation()]);
  assert.deepEqual(a, ['ok']);
  assert.deepEqual(b, ['ok']);
  assert.equal(calls, 1);

  await assert.rejects(
    tracker.run('broken', async () => {
      throw Object.assign(new Error('Failed to fetch'), { status: 530 });
    }),
  );
  assert.equal(tracker.getSnapshot().status, 'offline');
  assert.equal(tracker.canRequest(), false);
  await assert.rejects(tracker.run('another', async () => ['never']));
});
