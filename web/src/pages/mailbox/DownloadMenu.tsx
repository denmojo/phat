import { Download } from 'lucide-preact';
import { download, type DownloadFormat } from '../../lib/api';
import { IconButton } from '../../ui/IconButton';
import { Menu, type MenuItem } from '../../ui/Menu';

const FORMATS: [DownloadFormat, string, string][] = [
  ['b2f', 'B2F (Winlink file)', 'B2F'],
  ['eml', 'EML (email)', 'EML'],
  ['txt', 'TXT (plain text)', 'TXT'],
];

// downloadItems lists the formats as entries for a More actions menu,
// which phone-width toolbars use in place of the Download button.
export const downloadItems = (mids: string[]): MenuItem[] =>
  FORMATS.map(([format, , short]) => ({ label: `Download as ${short}`, icon: Download, onSelect: () => download(mids, format) }));

// DownloadMenu is the Download button and its format menu, for the open
// message or the ticked ones.
export function DownloadMenu({ mids }: { mids: string[] }) {
  return (
    <Menu trigger={<IconButton icon={Download} label="Download" title="Download (d)" />}
      items={FORMATS.map(([format, label]) => ({ label, onSelect: () => download(mids, format) }))} />
  );
}
