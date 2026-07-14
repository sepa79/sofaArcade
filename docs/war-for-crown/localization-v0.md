# War for Crown Localization v0

This document defines the player-facing text rule for War for Crown.

If this document conflicts with `AGENTS.md`, `AGENTS.md` wins.

## Rule

Every player-facing text must have an explicit value for every supported
language.

Current supported languages:

- `pl`
- `en`

No visible UI text may come directly from gameplay constants, enum values,
state IDs, or action/event discriminants.

## Boundaries

Pure game modules may keep stable IDs such as `plains`, `watchtower`, or
`province-16`. These are data/API identifiers, not display text.

The scene layer must translate those identifiers before rendering:

- terrain IDs become localized terrain names,
- fortification levels become localized fortification names,
- generated province IDs become localized province labels,
- battle/result/action enum values become localized phrases.

Player-provided names and proper names, including AI baron names, are treated as
names and are not translated.

## Failure Policy

Missing localization is an invalid UI state. It should fail during tests or at
the formatting boundary, not render a fallback language.
