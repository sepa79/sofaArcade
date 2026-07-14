import type { ArcadeGame } from './catalog';
import { createLauncherSelection, moveLauncherSelection, type LauncherSelection } from './selection';

export interface LauncherAssets {
  readonly logoUrl: string;
  readonly joystickUrl: string;
  readonly speakerUrl: string;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  node.className = className;
  return node;
}

function button(className: string, label: string): HTMLButtonElement {
  const node = element('button', className);
  node.type = 'button';
  node.textContent = label;
  return node;
}

export function renderArcadeLauncher(
  container: HTMLElement,
  assets: LauncherAssets,
  games: readonly ArcadeGame[]
): void {
  if (games.length === 0) {
    throw new Error('Sofa Arcade launcher requires at least one game.');
  }

  const backdrop = element('div', 'arcade-backdrop');
  backdrop.ariaHidden = 'true';
  for (let index = 0; index < 72; index += 1) {
    const star = element('i', `arcade-star arcade-star--${index % 4}`);
    star.style.setProperty('--star-x', `${(index * 37) % 101}%`);
    star.style.setProperty('--star-y', `${(index * 61) % 83}%`);
    star.style.setProperty('--star-delay', `${-(index % 9)}s`);
    backdrop.append(star);
  }

  const header = element('header', 'launcher-header');
  const logo = element('img', 'launcher-logo');
  logo.src = assets.logoUrl;
  logo.alt = 'Sofa Arcade';
  const subtitle = element('p', 'launcher-subtitle');
  subtitle.textContent = 'Bierz kontroler. Gramy.';
  header.append(logo, subtitle);

  const shell = element('section', 'launcher-shell');
  shell.ariaLabel = 'Wybór gry';
  const gamePanel = element('div', 'launcher-game-panel');
  const previousButton = button('launcher-arrow', '‹');
  previousButton.ariaLabel = 'Poprzednia gra';
  const nextButton = button('launcher-arrow', '›');
  nextButton.ariaLabel = 'Następna gra';

  const card = element('article', 'launcher-game-card');
  const gameCopy = element('div', 'launcher-game-copy');
  const title = element('h1', 'launcher-game-title');
  const description = element('p', 'launcher-game-description');
  const playerCount = element('p', 'launcher-player-count');
  const start = element('a', 'launcher-start-button');
  start.textContent = 'START';
  const previewFrame = element('div', 'launcher-preview-frame');
  const preview = element('img', 'launcher-preview-image');
  preview.alt = '';
  previewFrame.append(preview);
  gameCopy.append(title, description, playerCount, start);
  card.append(gameCopy, previewFrame);
  gamePanel.append(previousButton, card, nextButton);

  const infoPanel = element('aside', 'launcher-info-panel');
  const joystick = element('img', 'launcher-info-icon');
  joystick.src = assets.joystickUrl;
  joystick.alt = '';
  const infoCopy = element('div', 'launcher-info-copy');
  const infoTitle = element('strong', 'launcher-info-title');
  infoTitle.textContent = 'SOFA ARCADE';
  const infoText = element('span', 'launcher-info-text');
  infoText.textContent = 'Wybierz grę strzałkami. Sterowanie ustawisz po jej uruchomieniu.';
  infoCopy.append(infoTitle, infoText);
  const speaker = element('img', 'launcher-info-icon launcher-info-icon--speaker');
  speaker.src = assets.speakerUrl;
  speaker.alt = '';
  infoPanel.append(joystick, infoCopy, speaker);
  shell.append(gamePanel, infoPanel);

  const hint = element('p', 'launcher-hint');
  hint.textContent = 'LEWO/PRAWO: gra  ENTER: start';

  let selection: LauncherSelection = createLauncherSelection();

  const renderSelection = (): void => {
    const game = games[selection.gameIndex];
    if (game === undefined) {
      throw new Error(`Sofa Arcade game is missing for index ${selection.gameIndex}.`);
    }
    title.textContent = game.title;
    description.textContent = game.description;
    playerCount.textContent = game.players;
    preview.src = game.thumbnailUrl;
    start.href = game.href;
    start.ariaLabel = `Uruchom ${game.title}`;
  };

  const move = (delta: number): void => {
    selection = moveLauncherSelection(selection, delta, games.length);
    renderSelection();
  };

  previousButton.addEventListener('click', () => move(-1));
  nextButton.addEventListener('click', () => move(1));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      start.click();
    }
  });

  renderSelection();
  container.replaceChildren(backdrop, header, shell, hint);
}
