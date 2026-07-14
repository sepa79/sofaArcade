import soldierIconSvg from '@fortawesome/fontawesome-free/svgs/solid/users.svg?raw';

export const WAR_FOR_CROWN_SOLDIER_ICON_KEY = 'war-for-crown-soldiers';
const FONT_AWESOME_CURRENT_COLOR = 'fill="currentColor"';
if (!soldierIconSvg.includes(FONT_AWESOME_CURRENT_COLOR)) {
  throw new Error('Font Awesome soldier icon does not expose a currentColor fill.');
}
const whiteSoldierIconSvg = soldierIconSvg.replace(
  FONT_AWESOME_CURRENT_COLOR,
  'fill="#ffffff"'
);
export const WAR_FOR_CROWN_SOLDIER_ICON_URL =
  `data:image/svg+xml;base64,${window.btoa(whiteSoldierIconSvg)}`;
