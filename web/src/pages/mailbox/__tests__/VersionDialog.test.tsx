import { render, screen, fireEvent } from '@testing-library/preact';
import { VersionDialog, versionOffer } from '../VersionDialog';

const r = { version: '0.2.0', release_url: 'https://example.invalid/releases/0.2.0' };

beforeEach(() => {
  localStorage.clear();
  versionOffer.value = r;
});

test('offers the release with a link to its notes', () => {
  render(<VersionDialog />);
  expect(screen.getByText('Version 0.2.0 is available.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View release details' })).toHaveAttribute('href', r.release_url);
});

test('Ignore this version stores it and closes', () => {
  render(<VersionDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Ignore this version' }));
  expect(localStorage.getItem('pat_ignored_version')).toBe('0.2.0');
  expect(versionOffer.value).toBeNull();
});

test('Remind me later snoozes and closes', () => {
  render(<VersionDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Remind me later' }));
  expect(Number(localStorage.getItem('pat_version_check_time'))).toBeGreaterThan(0);
  expect(versionOffer.value).toBeNull();
});

test('Download opens the release page', () => {
  const open = vi.fn();
  vi.stubGlobal('open', open);
  render(<VersionDialog />);
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  expect(open).toHaveBeenCalledWith(r.release_url, '_blank', 'noopener');
  vi.unstubAllGlobals();
});
