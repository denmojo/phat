import { Toasts } from '../../ui/Toast';
import { Sidebar } from './Sidebar';
import { Toolbar, Topbar } from './Toolbar';
import { MessageList } from './MessageList';
import { MessagePane } from './MessagePane';
import { Composer } from './Composer';
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
        <section class="panel">
          {openMessage.value ? <MessagePane /> : <><Toolbar /><MessageList /></>}
        </section>
      </main>
      <Composer />
      <Toasts />
    </div>
  );
}
