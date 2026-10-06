import { render } from 'preact';
import '../../ui/base.css';
import { applyAppearance, type Appearance } from '../../ui/theme';
import { App } from './App';
import { requestPermission } from '../../lib/notify';
import { notifyState, refresh, refreshSidebar, startWs } from './store';
import { offerNewVersion } from './VersionDialog';
import { askAboutPat } from './PatDialog';

applyAppearance((document.documentElement.dataset.appearance as Appearance) || 'system');
render(<App />, document.getElementById('app')!);
void refreshSidebar();
void refresh();
startWs();
// Ask for desktop notifications on load, as the old client did.
void requestPermission().then((s) => { notifyState.value = s; });
offerNewVersion();
// First run after copying from Pat: ask once whether to connect through it.
void askAboutPat();
