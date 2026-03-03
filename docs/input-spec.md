# Input Layer Specification (Light80)

## Goal
Provide one shared input contract for all games. Games consume typed actions only. Device APIs stay outside gameplay modules.

## Core Model
- Action is the single source of truth for game-facing input.
- Every action has one explicit type:
  - `digital`: pressed/not pressed
  - `axis_1d`: scalar value with explicit coordinate model
- Every `axis_1d` defines:
  - `space`: `relative` or `absolute`
  - `domain`: `signed`, `unit`, or `byte`

## Axis Semantics
- `relative` axis:
  - Represents delta/intention for the current frame.
  - Reset to zero on `beginFrame()`.
  - Allowed domain: `signed` only.
- `absolute` axis:
  - Represents direct position in a stable range.
  - Persists between frames until updated.
  - Allowed domains:
    - `signed`: `-1..1`
    - `unit`: `0..1`
    - `byte`: `0..255` (paddle-style range)

## Runtime Contract
- `beginFrame()` must be called exactly once per simulation frame.
- Device adapters write values through:
  - `writeDigital(actionId, pressed)`
  - `writeAxis(actionId, value)`
- Games read values through:
  - `isPressed(actionId)`
  - `wasPressed(actionId)`
  - `readAxisRaw(actionId)`
  - `readAxisUnit(actionId)`
  - `readAxisSigned(actionId)`
- Preferred integration path: profile executor
  - `createInputSourceFrame(...)`
  - `applyInputProfile(runtime, profile, frame)`

## Validation Rules (Fail-Fast)
- Empty action catalog is invalid.
- Duplicate action IDs are invalid.
- Writing to unknown action is invalid.
- Writing wrong type to action is invalid.
- Axis writes outside declared domain are invalid.
- Relative axis with non-`signed` domain is invalid.

## Profiles and Bindings
- Profile is the SSOT for device-to-action mapping per player.
- Profile contains typed bindings and must validate against action catalog.
- Profiles are data files (JSON), not inline code declarations.
- Binding IDs are unique within a profile.
- Binding action type must match target action type.

## Device Adapter Boundary
- Device-specific polling is outside game logic.
- Adapters are responsible for reading keyboard/gamepad/mouse/HID and writing unified action values.
- Adapter project for DB9/USB must emit values aligned with this spec, especially `axis_1d absolute byte` for paddles.

## Example Mapping Patterns
- Keyboard left/right -> `axis_1d relative signed`.
- Gamepad left stick X -> `axis_1d relative signed`.
- Mouse horizontal position -> `axis_1d absolute byte`.
- Paddle position -> `axis_1d absolute byte`.
- Fire button -> `digital`.
