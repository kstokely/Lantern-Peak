// Pure logic for "music by camp": which files belong to a place, how a playlist is chosen when some
// files are missing, which track follows which, and which decoded places to release. No WebAudio here.

export type MusicPlace = 'menu' | 'shop' | 'camp1' | 'camp2' | 'camp3' | 'camp4' | 'camp5';

export const MUSIC_PLACES: MusicPlace[] = ['menu', 'shop', 'camp1', 'camp2', 'camp3', 'camp4', 'camp5'];
/** The old single loop: used for any place that has no file of its own. */
export const FALLBACK_TRACK = 'music';
/** Seconds of crossfade between tracks and between places. */
export const CROSSFADE_S = 1.5;
/** Places whose decoded buffers are kept at once. */
export const MAX_DECODED_PLACES = 2;

export function isMusicPlace(v: unknown): v is MusicPlace {
  return typeof v === 'string' && (MUSIC_PLACES as string[]).includes(v);
}

/** The camp place for a zone index (0..4). */
export function campPlace(zone: number): MusicPlace {
  const z = Math.max(0, Math.min(4, Math.floor(zone) || 0));
  return `camp${z + 1}` as MusicPlace;
}

/** Second parts (music_<place>b) are supported by the playlist logic but not probed by default (no 404 noise). */
export const PROBE_SECOND_PARTS = false;

/** Candidate files of a place in play order: the main track, then (when enabled) the optional second part. */
export function candidateTracks(place: MusicPlace, second = PROBE_SECOND_PARTS): string[] {
  return second ? [`music_${place}`, `music_${place}b`] : [`music_${place}`];
}

/** Known state of a file: true = exists, false = missing, undefined = not probed yet. */
export type Availability = (name: string) => boolean | undefined;

/**
 * The playlist to play for `place`. Files that are known to be missing are skipped; a file that
 * has not been probed yet counts as present (the caller probes the main track first). If no file of
 * the place exists the old music.mp3 is used; if that is known missing too the list is empty (synth loop).
 */
export function playlistFor(place: MusicPlace, avail: Availability, second = PROBE_SECOND_PARTS): string[] {
  const own = candidateTracks(place, second).filter((n) => avail(n) !== false);
  if (own.length) return own;
  return avail(FALLBACK_TRACK) === false ? [] : [FALLBACK_TRACK];
}

/** True when the playlist is the shared fallback rather than the place's own music. */
export function isFallbackList(list: string[]): boolean {
  return list.length === 1 && list[0] === FALLBACK_TRACK;
}

/** Index of the track after `i` (the playlist loops). */
export function nextIndex(i: number, len: number): number {
  return len <= 0 ? 0 : (i + 1) % len;
}

/** Should switching from the playing playlist to `next` start anything? Same list = no restart. */
export function needsSwitch(playing: string[] | null, next: string[]): boolean {
  if (!playing) return true;
  if (playing.length !== next.length) return true;
  return playing.some((n, i) => n !== next[i]);
}

/**
 * Least-recently-used set of places whose buffers are decoded. `touch` marks a place used and returns
 * the places to release (never the touched one or anything in `protect`).
 */
export class PlaceCache {
  private order: string[] = [];

  constructor(private max = MAX_DECODED_PLACES) {}

  touch(place: string, protect: string[] = []): string[] {
    this.order = this.order.filter((p) => p !== place);
    this.order.push(place);
    const evicted: string[] = [];
    for (let i = 0; this.order.length > this.max && i < this.order.length; ) {
      const p = this.order[i];
      if (p === place || protect.includes(p)) {
        i++;
        continue;
      }
      this.order.splice(i, 1);
      evicted.push(p);
    }
    return evicted;
  }

  has(place: string) {
    return this.order.includes(place);
  }

  places() {
    return this.order.slice();
  }
}
