vi.mock('../api', async (orig) => ({ ...(await orig<typeof import('../api')>()), recoveryEmail: vi.fn() }));
import * as api from '../api';
import { checkRecovery, dismissRecovery } from '../recovery';

const get = api.recoveryEmail as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

test('no recovery email means warn', async () => {
  get.mockResolvedValue({ recovery_email: '' });
  expect(await checkRecovery('N0CALL')).toBe('warn');
});

test('a set email is remembered for 30 days', async () => {
  vi.useFakeTimers();
  get.mockResolvedValue({ recovery_email: 'op@example.invalid' });
  expect(await checkRecovery('N0CALL')).toBe('ok');
  expect(localStorage.getItem('passwordRecoveryLastCheck_N0CALL')).not.toBeNull();
  expect(await checkRecovery('N0CALL')).toBe('skip');
  vi.setSystemTime(Date.now() + 31 * 24 * 3600 * 1000);
  expect(await checkRecovery('N0CALL')).toBe('ok');
  expect(get).toHaveBeenCalledTimes(2);
});

test('Later hides the warning for 84 hours, per callsign', async () => {
  vi.useFakeTimers();
  get.mockResolvedValue({ recovery_email: '' });
  dismissRecovery('N0CALL');
  expect(await checkRecovery('N0CALL')).toBe('skip');
  expect(await checkRecovery('K6ABC')).toBe('warn');
  vi.setSystemTime(Date.now() + 85 * 3600 * 1000);
  expect(await checkRecovery('N0CALL')).toBe('warn');
});

test('an unreachable account service skips quietly', async () => {
  get.mockRejectedValue(new Error('offline'));
  expect(await checkRecovery('N0CALL')).toBe('skip');
});
