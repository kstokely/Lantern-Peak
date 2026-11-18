// Hooks for automated testing, exposed as window.__LP.debug (see main.ts).
import type { Problem } from '../types';

export interface DebugMiniGame {
  readonly gameId: string;
  currentProblem(): Problem | null;
  /** Answers through the same path as a tap (correct = the right choice, else a wrong one). */
  answerCurrent(correct: boolean): string;
  close(): void;
}

export interface DebugWorld {
  readonly zone: number;
  readonly area: number;
  state(): Record<string, unknown>;
  teleport(x: number, y?: number): void;
  touchGem(i: number): boolean;
  touchPresent(i: number): boolean;
  touchFlurry(i: number): string;
  touchDoor(to: number): string;
  ringBell(): string;
  openStore(): void;
  goToSled(): void;
  collectRest(): void;
  // v4 platforming
  listPieces(): Record<string, unknown>;
  toCheckpoint(i: number): boolean;
  fallNow(): string;
  hold(key: 'left' | 'right' | 'jump' | 'down', ms: number): void;
  inputSeq(seq: { keys: string; ms?: number; toX?: number }[]): Promise<Record<string, unknown>>;
  oddJob(): string;
  refreshLoose(): number;
}

export const debugRefs: {
  miniGame: DebugMiniGame | null;
  world: DebugWorld | null;
  /** Hidden Dad mode: force the next Dad Lab question's topic (debug.dad(level, topic)); used once. */
  dadTopic: string | null;
} = { miniGame: null, world: null, dadTopic: null };
