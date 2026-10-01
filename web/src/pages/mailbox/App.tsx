import { ArrowLeft } from 'lucide-preact';
import { IconButton } from '../../ui/IconButton';
import { Toasts } from '../../ui/Toast';
import { Sidebar } from './Sidebar';
import { Toolbar, Topbar } from './Toolbar';
import { MessageList } from './MessageList';
import { closeMsg, drawerOpen, openMessage } from './store';
import './App.css';

// MessagePane is a stand-in until web Task 7 builds the message view.
function MessagePane() {
  const m = openMessage.value!;
  return (
    <>
      <div class="toolbar"><IconButton icon={ArrowLeft} label="Back" onClick={closeMsg} /></div>
      <article class="msg-stub">
        <h1>{m.Subject || '(no subject)'}</h1>
        <p class="muted">From {m.From?.Addr}</p>
        <pre>{m.Body}</pre>
      </article>
    </>
  );
}

export function App() {
  return (
    <div class="app">
      <Sidebar />
      {drawerOpen.value && <div class="drawer-scrim" onClick={() => { drawerOpen.value = false; }} />}
      <main class="main">
        <Topbar />
        <section class="panel">
          {openMessage.value ? <MessagePane /> : <><Toolbar /><MessageList /></>}
        </section>
      </main>
      <Toasts />
    </div>
  );
}
