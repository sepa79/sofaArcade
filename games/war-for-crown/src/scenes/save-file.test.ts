import { describe, expect, it } from 'vitest';

import { parseWarForCrownSaveText } from './save-file';

describe('War for Crown JSON save files', () => {
  it('reports the selected filename for malformed JSON', () => {
    expect(() => parseWarForCrownSaveText('{', 'broken.json')).toThrow(
      'Save file "broken.json" is not valid JSON.'
    );
  });
});
