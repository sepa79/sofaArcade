import {
  PLAYER_RAPID_FIRE_SHOOT_COOLDOWN,
  PLAYER_RAPID_FIRE_TAP_SHOOT_COOLDOWN,
  PLAYER_SHOOT_COOLDOWN,
  PLAYER_TAP_SHOOT_COOLDOWN,
  POWERUP_RAPID_FIRE_DURATION_SEC,
  POWERUP_SHIELD_DURATION_SEC
} from './constants';
import type { ActivePowerup, PlayerState, PowerupKind } from './types';

function assertNever(value: never, context: string): never {
  throw new Error(`${context}: ${String(value)}`);
}

function powerupDurationSec(kind: PowerupKind): number {
  if (kind === 'shield') {
    return POWERUP_SHIELD_DURATION_SEC;
  }
  if (kind === 'rapid-fire') {
    return POWERUP_RAPID_FIRE_DURATION_SEC;
  }

  return assertNever(kind, 'Unsupported powerup kind');
}

function validateDuration(durationSec: number, context: string): void {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`${context} must be a positive finite number, got ${durationSec}.`);
  }
}

function nextPowerupEntry(kind: PowerupKind): ActivePowerup {
  const remainingSec = powerupDurationSec(kind);
  validateDuration(remainingSec, `Powerup duration for "${kind}"`);
  return {
    kind,
    remainingSec
  };
}

export function hasActivePowerup(player: PlayerState, kind: PowerupKind): boolean {
  return player.activePowerups.some((powerup) => powerup.kind === kind);
}

export function applyPowerup(player: PlayerState, kind: PowerupKind): PlayerState {
  const nextPowerup = nextPowerupEntry(kind);
  const filtered = player.activePowerups.filter((powerup) => powerup.kind !== kind);
  return {
    ...player,
    activePowerups: filtered.concat(nextPowerup)
  };
}

export function tickPlayerPowerups(player: PlayerState, dt: number): PlayerState {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error(`dt must be a positive finite number, got ${dt}.`);
  }

  if (player.activePowerups.length === 0) {
    return player;
  }

  const activePowerups = player.activePowerups
    .map((powerup) => ({
      ...powerup,
      remainingSec: powerup.remainingSec - dt
    }))
    .filter((powerup) => powerup.remainingSec > 0);

  if (activePowerups.length === player.activePowerups.length) {
    const changed = activePowerups.some(
      (powerup, index) => powerup.remainingSec !== player.activePowerups[index]?.remainingSec
    );
    if (!changed) {
      return player;
    }
  }

  return {
    ...player,
    activePowerups
  };
}

export function tickPlayersPowerups(players: ReadonlyArray<PlayerState>, dt: number): ReadonlyArray<PlayerState> {
  return players.map((player) => tickPlayerPowerups(player, dt));
}

export function consumeShield(player: PlayerState): { readonly player: PlayerState; readonly consumed: boolean } {
  if (!hasActivePowerup(player, 'shield')) {
    return {
      player,
      consumed: false
    };
  }

  return {
    player: {
      ...player,
      activePowerups: player.activePowerups.filter((powerup) => powerup.kind !== 'shield')
    },
    consumed: true
  };
}

export function playerShootCooldown(player: PlayerState): number {
  return hasActivePowerup(player, 'rapid-fire') ? PLAYER_RAPID_FIRE_SHOOT_COOLDOWN : PLAYER_SHOOT_COOLDOWN;
}

export function playerTapShootCooldown(player: PlayerState): number {
  return hasActivePowerup(player, 'rapid-fire')
    ? PLAYER_RAPID_FIRE_TAP_SHOOT_COOLDOWN
    : PLAYER_TAP_SHOOT_COOLDOWN;
}

export function powerupHudLabel(kind: PowerupKind): string {
  if (kind === 'shield') {
    return 'SH';
  }
  if (kind === 'rapid-fire') {
    return 'RF';
  }

  return assertNever(kind, 'Unsupported HUD powerup label');
}
