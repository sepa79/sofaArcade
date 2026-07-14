# Release-known intentional cases

The following behaviors are deliberately retained for this release and must not
be silently normalized by runtime fallbacks:

- An externally supplied, deliberately malformed War for Crown save may contain
  an active battle with an empty `fromProvinceIds` array. Gameplay never creates
  this state. The case remains loadable as a corrupted-save probe and is not a
  supported gameplay state.
- The Artillery Duel launch menu intentionally treats every non-zero vertical
  axis value as active. It has no deadzone so analog-drift behavior remains an
  explicit regression scenario for a later input pass.

Sofa Arcade is released through GitHub Pages. The Windows portable static server
is outside the scope of this release pass.
