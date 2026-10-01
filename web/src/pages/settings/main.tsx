import { render } from 'preact';

render(<h1>{document.documentElement.dataset.appname} settings</h1>, document.getElementById('app')!);
