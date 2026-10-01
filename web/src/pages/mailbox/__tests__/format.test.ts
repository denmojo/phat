import { formatDate, folderTitle } from '../format';

const now = new Date(2026, 8, 30, 18, 0);
test('today shows the time, this year the day, older the year too', () => {
  expect(formatDate(new Date(2026, 8, 30, 15, 31).toISOString(), now)).toMatch(/3:31|15:31/);
  expect(formatDate(new Date(2026, 8, 29, 9, 0).toISOString(), now)).toMatch(/Sep 29|29 Sep/);
  expect(formatDate(new Date(2024, 0, 2).toISOString(), now)).toMatch(/2024/);
  expect(formatDate('garbage', now)).toBe('');
});
test('system folders get display names', () => {
  expect(folderTitle('in')).toBe('Inbox');
  expect(folderTitle('Radio Club')).toBe('Radio Club');
});
