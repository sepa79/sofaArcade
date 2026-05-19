# Commands — SofaArcade

This file contains canonical commands for humans and AI agents.

Agents must prefer these commands over ad-hoc guesses.

## Requirements

- Node.js 20
- pnpm 9
- TypeScript strict mode
- Vite/Phaser for game packages

## Install / bootstrap

```bash
pnpm install --frozen-lockfile
```

## Build

```bash
pnpm build
```

Focused package build:

```bash
pnpm --filter rolnik build
```

## Test

```bash
pnpm test
```

## Focused test

```bash
pnpm --filter rolnik test
pnpm --filter @light80/core test
pnpm --filter @light80/game-sdk test
```

## Lint / format / static checks

```bash
pnpm lint
```

Focused package lint:

```bash
pnpm --filter rolnik lint
```

## Run locally

```bash
pnpm dev
pnpm dev:rolnik
pnpm dev:web-portal
pnpm dev:signal-server
```

## Debug / inspect

```bash
pnpm --filter rolnik test -- --reporter=verbose
```

Prefer package-specific scripts first, then inspect the package `package.json` before adding new command forms.

## Package / release

```bash
pnpm package:distro
```

## Deployment

Current GitHub Pages deployment builds `pixel-invaders` only through `.github/workflows/pages.yml`.

Planned Rolnik deployment should add containerized services after the first backend slice exists:

```text
rolnik-service
web-portal
postgres
rolnik-discord-bot
```

## Known command caveats

- Root `dev` currently targets `pixel-invaders`; use `pnpm dev:rolnik` for Rolnik.
- The Pages workflow does not run the full root build/test/lint suite.
- Playwright is installed at root, but no Rolnik E2E harness exists yet.

## Agent command rules

- Do not invent commands when this file is incomplete.
- Inspect the relevant package `package.json` before adding or changing commands.
- Capture command output in evidence when preparing PRs or reviews.
