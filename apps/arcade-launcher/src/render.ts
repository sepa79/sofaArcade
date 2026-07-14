import type { ArcadeGame } from './catalog';

function createGameCard(game: ArcadeGame): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'game-card';
  link.href = game.href;
  link.dataset.gameId = game.id;

  const image = document.createElement('img');
  image.className = 'game-card__image';
  image.src = game.thumbnailUrl;
  image.alt = '';

  const content = document.createElement('span');
  content.className = 'game-card__content';

  const meta = document.createElement('span');
  meta.className = 'game-card__meta';
  meta.textContent = game.players;

  const title = document.createElement('strong');
  title.className = 'game-card__title';
  title.textContent = game.title;

  const description = document.createElement('span');
  description.className = 'game-card__description';
  description.textContent = game.description;

  const action = document.createElement('span');
  action.className = 'game-card__action';
  action.textContent = 'GRAJ';

  content.append(meta, title, description, action);
  link.append(image, content);
  return link;
}

export function renderArcadeLauncher(
  container: HTMLElement,
  logoUrl: string,
  games: readonly ArcadeGame[]
): void {
  const header = document.createElement('header');
  header.className = 'hero';

  const logo = document.createElement('img');
  logo.className = 'hero__logo';
  logo.src = logoUrl;
  logo.alt = 'Sofa Arcade';

  const intro = document.createElement('div');
  intro.className = 'hero__intro';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'hero__eyebrow';
  eyebrow.textContent = 'KANAPOWE GRANIE';

  const title = document.createElement('h1');
  title.textContent = 'Wybierz grę';

  const subtitle = document.createElement('p');
  subtitle.className = 'hero__subtitle';
  subtitle.textContent = 'Jedna sofa, jeden ekran, kilka dobrych powodów do rewanżu.';

  intro.append(eyebrow, title, subtitle);
  header.append(logo, intro);

  const grid = document.createElement('section');
  grid.className = 'game-grid';
  grid.ariaLabel = 'Gry Sofa Arcade';
  grid.append(...games.map(createGameCard));

  container.replaceChildren(header, grid);
}
