import { loadPortalConfig } from './config';
import { mountControllerApp } from './controller/app';
import { mountHostApp } from './host/app';
import './style.css';

const app = document.querySelector<HTMLElement>('#app');
if (app === null) {
  throw new Error('#app container is missing.');
}

if (window.location.pathname === '/controller') {
  mountControllerApp(app);
} else {
  const config = loadPortalConfig();
  mountHostApp(app, config.relayHttpUrl);
}
