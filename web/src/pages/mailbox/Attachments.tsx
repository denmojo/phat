import { useEffect, useState } from 'preact/hooks';
import { FileText, Paperclip, X } from 'lucide-preact';
import * as api from '../../lib/api';
import { formName } from '../../lib/forms';
import type { Message } from '../../lib/types';
import './Attachments.css';

const isImage = (name: string) => /\.(jpe?g|png|gif|bmp|webp)$/i.test(name);

export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// MessageAttachments lists a received message's files: a Winlink form is
// a button that opens the rendered form, an image previews inline, and
// anything else is a link to the file.
export function MessageAttachments({ m }: { m: Message }) {
  if (!m.Files || m.Files.length === 0) return null;
  return (
    <div class="atts">
      {m.Files.map((f) => {
        const url = api.attachmentUrl(m.Folder, m.MID, f.Name);
        const form = formName(f.Name);
        if (form) {
          return (
            <a key={f.Name} role="button" class="ui-btn ui-btn-default ui-btn-md attform" target="_blank" rel="noopener"
              href={api.attachmentUrl(m.Folder, m.MID, f.Name, true)}>
              <FileText />{form.replace(/_/g, ' ')}
            </a>
          );
        }
        if (isImage(f.Name)) {
          return (
            <a key={f.Name} class="attcard image" href={url} target="_blank" rel="noopener" title={f.Name}>
              <img src={url} alt={f.Name} loading="lazy" />
              <span class="cap"><span class="name">{f.Name}</span><span class="size">{fileSize(f.Size)}</span></span>
            </a>
          );
        }
        return (
          <a key={f.Name} class="attcard" href={url} target="_blank" rel="noopener">
            <Paperclip /><span class="name">{f.Name}</span><span class="size">{fileSize(f.Size)}</span>
          </a>
        );
      })}
    </div>
  );
}

// objectUrl gives a preview URL for a picked image and frees it on unmount.
function useObjectUrl(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isImage(file.name) || typeof URL.createObjectURL !== 'function') return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function DraftFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useObjectUrl(file);
  return (
    <div class={`attcard${url ? ' image' : ''}`}>
      {url ? <img src={url} alt={file.name} /> : <Paperclip />}
      <span class="cap"><span class="name">{file.name}</span><span class="size">{fileSize(file.size)}</span></span>
      <button type="button" class="attx" aria-label={`Remove ${file.name}`} onClick={onRemove}><X /></button>
    </div>
  );
}

// DraftAttachments shows the files picked for the message being written,
// each removable, images previewed.
export function DraftAttachments({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  if (files.length === 0) return null;
  return (
    <div class="atts">
      {files.map((f, i) => <DraftFile key={`${f.name}-${i}`} file={f} onRemove={() => onRemove(i)} />)}
    </div>
  );
}
