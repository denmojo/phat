import { useState } from 'preact/hooks';
import { LoaderCircle } from 'lucide-preact';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { answerPrompt, prompt } from './store';
import './PromptDialog.css';

// Prompts are answered with their own buttons only: the server is waiting.
const noClose = () => {};

function Password() {
  const [value, setValue] = useState('');
  return (
    <form class="prompt-form" onSubmit={(e) => { e.preventDefault(); answerPrompt(value); }}>
      <label class="prompt-field">
        <span>Password</span>
        <input type="password" autocomplete="off" autofocus value={value} placeholder="Enter password..."
          onInput={(e) => setValue(e.currentTarget.value)} />
      </label>
      <div class="prompt-actions"><span class="spacer" /><Button variant="primary" type="submit">OK</Button></div>
    </form>
  );
}

function MultiSelect({ options }: { options: { value: string; desc?: string; checked: boolean }[] }) {
  const [checked, setChecked] = useState(() => new Set(options.filter((o) => o.checked).map((o) => o.value)));
  const all = checked.size === options.length;
  const toggle = (v: string) => {
    const next = new Set(checked);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setChecked(next);
  };
  return (
    <>
      <ul class="prompt-list">
        {options.map((o) => (
          <li key={o.value}>
            <label>
              <input type="checkbox" checked={checked.has(o.value)} onChange={() => toggle(o.value)} />
              {`${o.desc || o.value} (${o.value})`}
            </label>
          </li>
        ))}
      </ul>
      <div class="prompt-actions">
        <Button onClick={() => setChecked(all ? new Set() : new Set(options.map((o) => o.value)))}>
          {all ? 'Deselect All' : 'Select All'}
        </Button>
        <span class="spacer" />
        <Button variant="primary" onClick={() => answerPrompt(options.filter((o) => checked.has(o.value)).map((o) => o.value).join(','))}>OK</Button>
      </div>
    </>
  );
}

// PromptDialog answers the server's prompts: the secure login password,
// which messages to download, a busy channel, and Winlink account
// activation. Each kind keeps the old client's controls and answers.
export function PromptDialog() {
  const p = prompt.value;
  if (!p) return null;
  let body;
  switch (p.kind) {
    case 'password':
      body = <Password key={p.id} />;
      break;
    case 'multi-select':
      body = <MultiSelect key={p.id} options={p.options ?? []} />;
      break;
    case 'busy-channel':
      body = (
        <>
          <div class="prompt-busy" aria-hidden="true"><LoaderCircle /></div>
          <div class="prompt-actions">
            <span class="spacer" />
            <Button onClick={() => answerPrompt('continue')}>Continue anyway</Button>
            <Button variant="primary" onClick={() => answerPrompt('abort')}>Abort</Button>
          </div>
        </>
      );
      break;
    case 'pre-account-activation':
      body = (
        <>
          <div class="prompt-text">
            <p class="warn"><strong>WARNING:</strong> We were unable to confirm that your Winlink account is active.</p>
            <p>If you continue, an over-the-air activation will be initiated and you will receive a message with a new password.</p>
            <p>This password will be the only key to your account. If you lose it, it cannot be recovered.</p>
            <p>It is strongly recommended to create your account before proceeding.</p>
          </div>
          <div class="prompt-actions">
            <Button onClick={() => answerPrompt('confirmed')}>Continue anyway</Button>
            <span class="spacer" />
            <Button onClick={() => answerPrompt('abort')}>Abort</Button>
            <Button variant="primary" onClick={() => {
              answerPrompt('abort');
              location.assign('/ui/config?action=create-account');
            }}>Create new account</Button>
          </div>
        </>
      );
      break;
    case 'account-activation':
      body = (
        <>
          <div class="prompt-text">
            <p>Welcome! The system has automatically generated a password for your new account.</p>
            <p>This password is in a message that is ready to be downloaded to your inbox during this session.</p>
            <p class="warn"><strong>WARNING:</strong> Once you download this message, the password inside is the only key to your account. If you lose it, it cannot be recovered.</p>
            <p>Are you ready to receive this message and save the password securely right now?</p>
          </div>
          <div class="prompt-actions">
            <span class="spacer" />
            <Button onClick={() => answerPrompt('defer')}>Postpone to Next Connection</Button>
            <Button variant="primary" onClick={() => answerPrompt('accept')}>Yes, Download Now</Button>
          </div>
        </>
      );
      break;
    default:
      return null;
  }
  return (
    <Dialog open title={p.message} onClose={noClose} dismissable={false}>
      <div class="prompt">{body}</div>
    </Dialog>
  );
}
