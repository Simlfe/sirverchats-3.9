interface AuthStore {
  token: string;
  model: { id?: string; collectionId?: string } | null;
  onChange(callback: () => void): () => void;
}

/** Profile saves fire authStore.onChange too; only credentials require a new SSE session. */
export function watchRealtimeCredentials(store: AuthStore, reset: () => Promise<void>) {
  const identity = () => JSON.stringify([store.token, store.model?.collectionId, store.model?.id]);
  let previous = identity();
  let pending = false;
  let running = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const drain = async () => {
    timer = undefined;
    if (disposed || running) return;
    running = true;
    try {
      while (pending && !disposed) {
        pending = false;
        await reset();
      }
    } catch (error) {
      console.warn('[REALTIME] Credential reset failed:', error);
    } finally {
      running = false;
    }
  };
  const requestReset = () => {
    if (disposed) return;
    pending = true;
    if (!running && timer === undefined) timer = setTimeout(() => void drain(), 0);
  };
  const unsubscribe = store.onChange(() => {
    const next = identity();
    if (next === previous) return;
    previous = next;
    requestReset();
  });
  return {
    requestReset,
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe();
    },
  };
}
