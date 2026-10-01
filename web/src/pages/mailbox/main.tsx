import { render } from 'preact';

render(<h1>{document.documentElement.dataset.appname} mailbox</h1>, document.getElementById('app')!);
