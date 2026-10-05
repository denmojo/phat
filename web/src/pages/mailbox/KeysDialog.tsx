import { useHotkeys } from '../../lib/hotkeys';
import { Dialog } from '../../ui/Dialog';
import { keysOpen, openMessage } from './store';
import './KeysDialog.css';

type Group = [string, [string, string][]];

const MESSAGE: Group = ['Message view', [
  ['j', 'Next message'],
  ['k', 'Previous message'],
  ['h', 'Back to the list'],
  ['r', 'Reply'],
  ['R', 'Reply all'],
  ['f', 'Forward'],
  ['n', 'New message'],
  ['a', 'Archive, or move to Inbox from the archive'],
  ['t', 'Delete (Enter confirms)'],
  ['u', 'Mark unread and go back to the list'],
  ['s', 'Star or unstar'],
  ['l', 'Labels'],
  ['m', 'Move to'],
]];

const LIST: Group = ['Message list', [
  ['n', 'New message'],
  ['t', 'Delete the selected messages (Enter confirms)'],
  ['Enter', 'Open the selected message (one ticked)'],
  ['a', 'Archive the selected, or move them to Inbox from the archive'],
  ['u', 'Mark unread, or read if all are unread'],
  ['s', 'Star, or unstar if all are starred'],
  ['l', 'Labels for the selected'],
  ['m', 'Move the selected'],
]];

const ANYWHERE: Group = ['Anywhere', [
  ['c', 'Connect'],
  ['/', 'Search'],
  ['?', 'This list'],
]];

const close = () => { keysOpen.value = false; };

// KeysDialog lists the keyboard shortcuts available on the current screen:
// the message keys over an open message, the list keys otherwise, and the
// ones that work anywhere. ? opens it; so do the help buttons in the top
// bar and the sidebar.
export function KeysDialog() {
  useHotkeys({ '?': () => { keysOpen.value = true; } });
  const groups = [openMessage.value ? MESSAGE : LIST, ANYWHERE];
  return (
    <Dialog open={keysOpen.value} title="Keyboard shortcuts" onClose={close}>
      <div class="dialog-pad keys">
        {groups.map(([name, keys]) => (
          <section key={name}>
            <h3>{name}</h3>
            <dl>
              {keys.map(([k, what]) => (
                <div key={k}><dt><kbd>{k}</kbd></dt><dd>{what}</dd></div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
