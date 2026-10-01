import { Toasts } from '../../ui/Toast';
import { Sidebar } from './Sidebar';
import { Toolbar, Topbar } from './Toolbar';
import { MessageList } from './MessageList';
import { MessagePane } from './MessagePane';
import { drawerOpen, openMessage } from './store';
import './App.css';

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
