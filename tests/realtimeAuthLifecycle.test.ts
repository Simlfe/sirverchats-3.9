import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseAuthStore } from 'pocketbase';
import { watchRealtimeCredentials } from '../src/services/realtimeAuthLifecycle';

const tick = () => new Promise(resolve => setTimeout(resolve, 15));
class TestAuthStore extends BaseAuthStore {}

test('profile and presence saves do not reset realtime; credential changes do', async () => {
  const store = new TestAuthStore();
  store.save('token-a', { id: 'user-a', collectionId: 'users' });
  let resets = 0;
  const lifecycle = watchRealtimeCredentials(store, async () => { resets++; });
  for (let i = 0; i < 100; i++) store.save('token-a', { id: 'user-a', collectionId: 'users', last_seen: i });
  await tick();
  assert.equal(resets, 0);
  store.save('token-b', { id: 'user-a', collectionId: 'users' });
  await tick();
  assert.equal(resets, 1);
  store.clear();
  await tick();
  assert.equal(resets, 2);
  lifecycle.dispose();
});

test('burst resets coalesce and disposal cancels pending recovery', async () => {
  const store = new TestAuthStore();
  let resets = 0;
  const lifecycle = watchRealtimeCredentials(store, async () => { resets++; });
  for (let i = 0; i < 20; i++) lifecycle.requestReset();
  await tick();
  assert.equal(resets, 1);
  lifecycle.requestReset();
  lifecycle.dispose();
  await tick();
  assert.equal(resets, 1);
});
