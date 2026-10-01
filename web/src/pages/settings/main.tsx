import { render } from 'preact';
import '../../ui/base.css';
import { applyAppearance, type Appearance } from '../../ui/theme';
import { App } from './App';

applyAppearance((document.documentElement.dataset.appearance as Appearance) || 'system');
render(<App />, document.getElementById('app')!);
