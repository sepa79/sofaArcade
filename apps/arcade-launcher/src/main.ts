import sofaArcadeLogo from '../../../sofaArcade.png';
import { createArcadeCatalog } from './catalog';
import { renderArcadeLauncher } from './render';
import './style.css';

const app = document.querySelector<HTMLElement>('#app');
if (app === null) {
  throw new Error('Missing Sofa Arcade launcher root element #app.');
}

renderArcadeLauncher(app, sofaArcadeLogo, createArcadeCatalog(import.meta.env.BASE_URL));
