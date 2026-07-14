import { describe, expect, it, vi } from 'vitest';

import { chooseDeterministicAiAction, createAiClient } from './ai';
import { DEFAULT_GAME_CONFIG } from './constants';
import { ROYALIST_OWNER_ID } from './owners';
import { createSimulation, runMatch, stepMatch, type SimulationClients } from './simulation';
import type { WarForCrownAction } from './actions';
import type { PlayerView } from './player-view';

const aiClients: SimulationClients = {
  p1: chooseDeterministicAiAction,
  p2: chooseDeterministicAiAction,
  p3: chooseDeterministicAiAction,
  p4: chooseDeterministicAiAction
};

describe('headless simulation', () => {
  it('asks only the active player client for a step action', () => {
    const p1 = vi.fn((view: PlayerView): WarForCrownAction => {
      const provinceId = view.selectableHomeProvinceIds[0];
      if (provinceId === undefined) {
        throw new Error('Expected at least one selectable province.');
      }
      return { type: 'select-home', provinceId };
    });
    const p2 = vi.fn((): WarForCrownAction => {
      throw new Error('Inactive client must not be called.');
    });
    const p3 = vi.fn((): WarForCrownAction => {
      throw new Error('Inactive client must not be called.');
    });
    const p4 = vi.fn((): WarForCrownAction => {
      throw new Error('Inactive client must not be called.');
    });
    const runtime = createSimulation({
      seed: 7,
      clients: { p1, p2, p3, p4 },
      maxSteps: 10
    });

    const next = stepMatch(runtime);

    expect(p1).toHaveBeenCalledTimes(1);
    expect(p2).not.toHaveBeenCalled();
    expect(p3).not.toHaveBeenCalled();
    expect(p4).not.toHaveBeenCalled();
    expect(next.transcript.steps).toHaveLength(1);
    expect(next.transcript.steps[0]).toMatchObject({
      stepNumber: 1,
      playerId: 'p1',
      phase: 'home-selection',
      turnStep: 'new-month',
      action: { type: 'select-home' },
      events: [{ type: 'home-selected', playerId: 'p1' }]
    });

    const step = next.transcript.steps[0];
    if (step === undefined) {
      throw new Error('Expected first transcript step.');
    }
    if (step.action.type !== 'select-home') {
      throw new Error(`Expected select-home transcript action, got ${step.action.type}.`);
    }
    const selectedProvinceId = step.action.provinceId;
    const beforeProvince = step.before.provinces.find((province) => province.id === selectedProvinceId);
    const afterProvince = step.after.provinces.find((province) => province.id === selectedProvinceId);
    const beforeP1 = step.before.players.find((player) => player.id === 'p1');
    const afterP1 = step.after.players.find((player) => player.id === 'p1');
    const afterP1Owner = step.after.owners.find((owner) => owner.ownerId === 'p1');
    const beforeRoyalists = step.before.owners.find((owner) => owner.ownerId === ROYALIST_OWNER_ID);
    const afterRoyalists = step.after.owners.find((owner) => owner.ownerId === ROYALIST_OWNER_ID);

    expect(beforeProvince).toMatchObject({ ownerId: ROYALIST_OWNER_ID });
    expect(afterProvince).toMatchObject({
      ownerId: 'p1',
      soldiers: DEFAULT_GAME_CONFIG.startingSoldiers
    });
    expect(beforeP1).toMatchObject({ provinceCount: 0, soldierCount: 0 });
    expect(afterP1).toMatchObject({
      homeProvinceId: selectedProvinceId,
      provinceCount: 1,
      soldierCount: DEFAULT_GAME_CONFIG.startingSoldiers
    });
    expect(afterP1Owner).toMatchObject({
      provinceCount: 1,
      soldierCount: DEFAULT_GAME_CONFIG.startingSoldiers
    });
    expect(beforeRoyalists?.provinceCount).toBe(DEFAULT_GAME_CONFIG.provinceCount);
    expect(afterRoyalists?.provinceCount).toBe(DEFAULT_GAME_CONFIG.provinceCount - 1);
  });

  it('runs deterministic AI clients through the public action API', () => {
    const runtime = runMatch({
      seed: 11,
      clients: aiClients,
      maxSteps: 80
    });
    const eventTypes = runtime.transcript.steps.flatMap((step) =>
      step.events.map((event) => event.type)
    );

    expect(runtime.state.phase).not.toBe('home-selection');
    expect(runtime.transcript.steps.length).toBeGreaterThan(2);
    expect(eventTypes).toContain('home-selected');
    expect(eventTypes).toContain('turn-step-advanced');
    expect(eventTypes).toContain('income-collected');
    expect(
      eventTypes.some((eventType) =>
        ['village-built', 'fortification-upgraded', 'soldiers-recruited'].includes(eventType)
      )
    ).toBe(true);
  });

  it('returns step-limit-reached when the step budget ends before a winner appears', () => {
    const runtime = runMatch({
      seed: 11,
      clients: aiClients,
      maxSteps: 4
    });

    expect(runtime.state.phase).toBe('turn');
    expect(runtime.state.winnerId).toBeNull();
    expect(runtime.transcript.status).toBe('step-limit-reached');
    expect(runtime.transcript.steps).toHaveLength(4);
    expect(runtime.transcript.finalTurnNumber).toBe(runtime.state.turnNumber);
    expect(runtime.transcript.winnerId).toBeNull();
  });

  it('does not recover from invalid client actions', () => {
    const invalidClients: SimulationClients = {
      p1: () => ({ type: 'end-turn' }),
      p2: chooseDeterministicAiAction,
      p3: chooseDeterministicAiAction,
      p4: chooseDeterministicAiAction
    };
    const runtime = createSimulation({
      seed: 3,
      clients: invalidClients,
      maxSteps: 4
    });

    expect(() => stepMatch(runtime)).toThrow('Cannot end turn during phase "home-selection".');
  });

  it('runs c64-original AI clients to game over through the public action API', () => {
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 2,
      provinceCount: 16
    };
    const runtime = runMatch({
      seed: 15,
      config,
      clients: {
        p1: createAiClient('c64-original', config),
        p2: createAiClient('c64-original', config)
      },
      maxSteps: 200
    });

    expect(runtime.transcript.status).toBe('game-over');
    expect(runtime.state.phase).toBe('game-over');
    expect(runtime.state.winnerId).toBe('p2');
    expect(runtime.state.turnNumber).toBe(17);
    expect(runtime.transcript.steps.length).toBeLessThan(200);
    expect(runtime.transcript.steps.every((step) => step.before.provinces.length > 0)).toBe(true);
    expect(runtime.transcript.steps.every((step) => step.after.owners.length > 0)).toBe(true);
  });

  it('runs a bounded mixed c64-original and c64-workbench public-API smoke test', () => {
    const originalClient = createAiClient('c64-original');
    const workbenchClient = createAiClient('c64-workbench');
    const runtime = runMatch({
      seed: 42,
      clients: {
        p1: originalClient,
        p2: workbenchClient,
        p3: originalClient,
        p4: workbenchClient
      },
      maxSteps: 100
    });

    expect(runtime.transcript.status).toBe('step-limit-reached');
    expect(runtime.state.phase).toBe('turn');
    expect(runtime.state.winnerId).toBeNull();
  });

  it('runs hostile C64 royalists during c64-original public API matches', () => {
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 4,
      royalistAttitude: 'hostile' as const
    };
    const client = createAiClient('c64-original', config);
    const runtime = runMatch({
      seed: 2,
      config,
      clients: { p1: client, p2: client, p3: client, p4: client },
      maxSteps: 120
    });
    const royalistBattles = runtime.transcript.steps.flatMap((step) =>
      step.events.filter((event) => event.type === 'royalist-battle-resolved')
    );

    expect(runtime.transcript.status).toBe('step-limit-reached');
    expect(runtime.state.phase).toBe('turn');
    expect(royalistBattles.length).toBeGreaterThan(0);
  });
});
