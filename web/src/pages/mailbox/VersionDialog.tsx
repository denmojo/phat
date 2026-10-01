import { signal } from '@preact/signals';
import { type Release, ignoreVersion, remindLater } from '../../lib/version';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';

// versionOffer holds a newer release to tell the user about.
export const versionOffer = signal<Release | null>(null);
const dismiss = () => { versionOffer.value = null; };

export function VersionDialog() {
  const r = versionOffer.value;
  if (!r) return null;
  return (
    <Dialog open title="A new version is available" onClose={dismiss}
      footer={(
        <>
          <Button onClick={() => { ignoreVersion(r.version); dismiss(); }}>Ignore this version</Button>
          <span class="spacer" />
          <Button onClick={() => { remindLater(); dismiss(); }}>Remind me later</Button>
          <Button variant="primary" onClick={() => { window.open(r.release_url, '_blank', 'noopener'); dismiss(); }}>Download</Button>
        </>
      )}>
      <div class="dialog-pad">
        <p>{`Version ${r.version} is available.`}</p>
        <p><a href={r.release_url} target="_blank" rel="noopener">View release details</a></p>
      </div>
    </Dialog>
  );
}
