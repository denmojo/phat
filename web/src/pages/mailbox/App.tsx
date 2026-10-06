import { Toasts } from '../../ui/Toast';
import { Sidebar } from './Sidebar';
import { Toolbar, Topbar } from './Toolbar';
import { MessageList } from './MessageList';
import { MessagePane } from './MessagePane';
import { Composer } from './Composer';
import { ConnectDialog } from './ConnectDialog';
import { PositionDialog } from './PositionDialog';
import { ProgressBar } from './ProgressBar';
import { PromptDialog } from './PromptDialog';
import { SessionLog } from './SessionLog';
import { VersionDialog } from './VersionDialog';
import { PatDialog } from './PatDialog';
import { KeysDialog } from './KeysDialog';
import { configChanged, drawerOpen, openMessage } from './store';
import './App.css';

export function App() {
  return (
    <div class="app">
      <Sidebar />
      {drawerOpen.value && <div class="drawer-scrim" onClick={() => { drawerOpen.value = false; }} />}
      <main class="main">
        {configChanged.value && (
          <div class="banner" role="alert">
            <span>Configuration changed, reload the page</span>
            <button type="button" onClick={() => location.reload()}>Reload</button>
          </div>
        )}
        <Topbar />
        <ProgressBar />
        <section class="panel">
          {openMessage.value ? <MessagePane /> : <><Toolbar /><MessageList /></>}
        </section>
        <SessionLog />
      </main>
      <Composer />
      <ConnectDialog />
      <PositionDialog />
      <VersionDialog />
      <PatDialog />
      <KeysDialog />
      {/* Last, so a prompt opens above any other dialog. */}
      <PromptDialog />
      <Toasts />
    </div>
  );
}
