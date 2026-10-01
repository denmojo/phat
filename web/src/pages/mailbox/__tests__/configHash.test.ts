import type { Status } from '../../../lib/types';

const st = (hash: string) => ({ config_hash: hash } as Status);

// Each test gets a fresh store, so no hash carries over from the last one.
async function freshStore() {
  vi.resetModules();
  return import('../store');
}

let reload: ReturnType<typeof vi.fn>;
beforeEach(() => {
  reload = vi.fn();
  vi.stubGlobal('location', { reload });
});
afterEach(() => vi.unstubAllGlobals());

test('a config change while the composer is open raises the banner instead of reloading', async () => {
  const store = await freshStore();
  store.composerOpen.value = true;
  store.handleStatus(st('a1'));
  store.handleStatus(st('b2'));
  expect(store.configChanged.value).toBe(true);
  expect(reload).not.toHaveBeenCalled();
});

test('a config change with the composer closed reloads the page', async () => {
  const store = await freshStore();
  store.handleStatus(st('a1'));
  store.handleStatus(st('b2'));
  expect(reload).toHaveBeenCalledTimes(1);
  expect(store.configChanged.value).toBe(false);
});

test('the first status and a repeated hash change nothing', async () => {
  const store = await freshStore();
  store.handleStatus(st('a1'));
  store.handleStatus(st('a1'));
  expect(reload).not.toHaveBeenCalled();
  expect(store.configChanged.value).toBe(false);
});
