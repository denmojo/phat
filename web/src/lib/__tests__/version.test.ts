vi.mock('../api', async (orig) => ({ ...(await orig<typeof import('../api')>()), newReleaseCheck: vi.fn() }));
import * as api from '../api';
import { checkNewVersion, ignoreVersion, remindLater } from '../version';

const check = api.newReleaseCheck as unknown as ReturnType<typeof vi.fn>;
const release = { version: '0.2.0', release_url: 'https://example.invalid/r/0.2.0' };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

test('a newer release is offered once per session', async () => {
  check.mockResolvedValue(release);
  expect(await checkNewVersion()).toEqual(release);
  expect(sessionStorage.getItem('pat_version_checked')).toBe('true');
  expect(await checkNewVersion()).toBeNull();
  expect(check).toHaveBeenCalledTimes(1);
});

test('no newer release (204, empty body) offers nothing', async () => {
  check.mockResolvedValue(undefined);
  expect(await checkNewVersion()).toBeNull();
});

test('Remind me later skips the check for 72 hours', async () => {
  vi.useFakeTimers();
  check.mockResolvedValue(release);
  remindLater();
  expect(await checkNewVersion()).toBeNull();
  expect(check).not.toHaveBeenCalled();
  vi.setSystemTime(Date.now() + 73 * 3600 * 1000);
  expect(await checkNewVersion()).toEqual(release);
  vi.useRealTimers();
});

test('an ignored version is never offered again', async () => {
  check.mockResolvedValue(release);
  ignoreVersion('0.2.0');
  expect(await checkNewVersion()).toBeNull();
  expect(localStorage.getItem('pat_ignored_version')).toBe('0.2.0');
});

test('a failed check offers nothing and does not throw', async () => {
  check.mockRejectedValue(new Error('offline'));
  expect(await checkNewVersion()).toBeNull();
});
