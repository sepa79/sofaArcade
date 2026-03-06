import { describe, expect, it } from 'vitest';

import { createMatchInput } from './match-input';

describe('createMatchInput', () => {
  it('accepts strictly ordered player inputs', () => {
    const input = createMatchInput([
      {
        playerIndex: 0,
        input: {
          moveX: -1
        }
      },
      {
        playerIndex: 1,
        input: {
          moveX: 1
        }
      }
    ]);

    expect(input.players).toHaveLength(2);
  });

  it('rejects empty player input list', () => {
    expect(() => createMatchInput([])).toThrowError('Match input must define at least one player frame.');
  });

  it('rejects unordered player inputs', () => {
    expect(() =>
      createMatchInput([
        {
          playerIndex: 1,
          input: {
            moveX: 1
          }
        },
        {
          playerIndex: 0,
          input: {
            moveX: -1
          }
        }
      ])
    ).toThrowError('Match input players must be ordered by strictly increasing playerIndex.');
  });
});
