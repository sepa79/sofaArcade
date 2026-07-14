import sofaArcadeLogo from '../../../games/shared-assets/src/logo_cropped.png';
import launcherJoystick from '../../../games/shared-assets/src/launcher_joystick.png';
import launcherSpeaker from '../../../games/shared-assets/src/launcher_speaker.png';
import { createArcadeCatalog } from './catalog';
import { renderArcadeLauncher } from './render';
import './style.css';

const app = document.querySelector<HTMLElement>('#app');
if (app === null) {
  throw new Error('Missing Sofa Arcade launcher root element #app.');
}

renderArcadeLauncher(
  app,
  {
    logoUrl: sofaArcadeLogo,
    joystickUrl: launcherJoystick,
    speakerUrl: launcherSpeaker
  },
  createArcadeCatalog(import.meta.env.BASE_URL)
);
