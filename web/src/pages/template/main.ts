import '../../ui/base.css';
import '../../ui/Button.css';
import './template.css';
import { applyAppearance, type Appearance } from '../../ui/theme';
import { mount } from './template';

applyAppearance((document.documentElement.dataset.appearance as Appearance) || 'system');
void mount(document.getElementById('app')!, location.search);
