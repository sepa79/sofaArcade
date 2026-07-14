# War for Crown UI Skin v0

This document defines the first skin-ready UI pass for the Phaser scene.

## Goal

The current UI should stop looking like a generic web dashboard. It should move
toward the C64 War for Crown mood:

- black negative space and compact central composition,
- cyan labels, violet values, and warm yellow highlights,
- bronze ornamental frames with textured side pillars and notched dividers,
- a sword-shaped hover marker,
- compact, readable text,
- panels that can later be replaced by bitmap assets from JurasEd.

## Skin Contract

`games/war-for-crown/src/scenes/war-for-crown-scene.ts` keeps one UI skin
object for scene presentation:

- font stack,
- background, panel, text, button, warning, and frame colors,
- frame geometry values.

Scene render code must read those values from that skin object instead of adding
new one-off style constants.

## Asset Slots

The v0 implementation draws frames in Phaser graphics so it remains testable
without finished art. Later JurasEd assets should replace the drawing helper,
not the game logic.

Expected future asset slots:

- panel frame corners,
- horizontal and vertical frame edges,
- button frame,
- phase overlay frame,
- optional bitmap font.

## Font

The UI uses the locally bundled Atkinson Hyperlegible Regular under the SIL
Open Font License 1.1. It is the single proportional font for scene and map
text, selected for legibility at small panel sizes rather than a retro or C64
look. The game must finish loading the font before creating Phaser; there is no
runtime font fallback. Phaser and CSS keep canvas scaling antialiased so the
font is not converted into pixel-art glyphs. The renderer backing buffer,
camera zoom, and Phaser text-texture resolution use one physical render scale
derived from the viewport fit and `devicePixelRatio`; the browser does not
enlarge a pre-rendered 1280x720 text image.

Map soldier counts use the locally bundled Font Awesome Free `users` SVG. It is
rasterized by Phaser at the asset-loading boundary under the Font Awesome Free
license; the game does not request icon assets from the network.

## Rules

- No UI skin values inside game logic.
- No duplicate color/font constants outside the scene skin object.
- Missing future bitmap assets must fail at the asset-loading boundary; the v0
  graphics skin has no hidden asset fallback.

## C64 reference interpretation

The skin follows the composition and color hierarchy of the original options
screen without copying its bitmap font. Main menus use a compact central frame
with generous black margins. Settings keep labels and selected values visually
distinct. Mouse hover takes the role of the original sword cursor.

## Map

The map interprets the C64 gameplay screen through deterministic Phaser vector
patterns rather than bitmap tiles. Terrain has a distinct repeated motif, water
uses diagonal wave bands, and province edges use a stone-and-mortar boundary.
Province badges show soldiers and villages with separate pictograms, while
player ownership, home castles, and fortifications remain visible without
changing map or gameplay state. Badge width is derived from the current tile
size and always remains narrower than a tile, so adjacent one-tile provinces do
not overlap at overview zoom.

Map drawing primitives and their palette live in
`games/war-for-crown/src/scenes/map-visuals.ts`. The scene owns composition and
state selection only.
