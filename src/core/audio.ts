// AudioManager: plays audio/<name>.mp3 when present, otherwise a WebAudio-synthesised fallback.
// Voice lines have no fallback (skipped when the file is missing). Works with zero audio files.
import { persist, save } from './save';
import { CROSSFADE_S, FALLBACK_TRACK, MusicPlace, candidateTracks, isFallbackList, needsSwitch, nextIndex, playlistFor } from './musicPlaylist';

export type { MusicPlace } from './musicPlaylist';

interface MusicVoice {
  name: string;
  el: HTMLAudioElement;
  node: MediaElementAudioSourceNode;
  gain: GainNode;
  fading: boolean;
  chained: boolean;
  timer: number | null;
}

export type SfxName =
  | 'correct' | 'wrong' | 'gem' | 'present_shake' | 'present_open' | 'step' | 'camp' | 'win' | 'click' | 'wind'
  // v2
  | 'bell' | 'buy' | 'ice_crack' | 'flurry' | 'loose_gem' | 'door'
  // v4 platforming (synthesised only: no files are probed for these)
  | 'tick' | 'bounce' | 'checkpoint' | 'poof' | 'puff' | 'crumble';

const SYNTH_ONLY = new Set<SfxName>(['tick', 'bounce', 'checkpoint', 'poof', 'puff', 'crumble']);

/** Per-sfx playback volume (files) and minimum gap between plays in ms (rate limit). */
const SFX_VOL: Partial<Record<SfxName, number>> = { step: 0.5, loose_gem: 0.45 };
const SFX_GAP: Partial<Record<SfxName, number>> = { step: 120, loose_gem: 90, flurry: 250, tick: 300, bounce: 120, crumble: 200 };

type LoadState = 'unknown' | 'loading' | 'ok' | 'missing';

const MUSIC_VOL = 0.16;
const DUCK = 0.35;
const MUSIC_TRACK_VOL = 0.9;

class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private voiceBus!: GainNode;
  private windBus!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private state = new Map<string, LoadState>();
  private loads = new Map<string, Promise<AudioBuffer | null>>();
  private manifest: Promise<Set<string> | null> | null = null;
  private noise: AudioBuffer | null = null;
  private musicOn = false;
  private musicTimer: number | null = null;
  private musicNextTime = 0;
  private musicStep = 0;
  private windSrc: AudioScheduledSourceNode | null = null;
  private windNodes: AudioNode[] = [];
  private voiceSrc: AudioBufferSourceNode | null = null;
  private lastVoice = new Map<string, string>();
  private lastPlay = new Map<SfxName, number>();

  /** Create/resume the AudioContext. Call from a user gesture (first click/key). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = save.muted ? 0 : 1;
      this.master.connect(c.destination);
      this.sfxBus = this.bus(0.55);
      this.musicBus = this.bus(MUSIC_VOL);
      this.voiceBus = this.bus(1);
      this.windBus = this.bus(0.0);
      if (this.musicOn) this.beginMusic();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
    this.kickMusic();
  }

  get unlocked() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  private bus(vol: number) {
    const g = this.ctx!.createGain();
    g.gain.value = vol;
    g.connect(this.master);
    return g;
  }

  isMuted() {
    return save.muted;
  }

  setMuted(m: boolean) {
    save.muted = m;
    persist();
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.03);
  }

  // ---------- file loading ----------

  private url(name: string) {
    return new URL(`audio/${name}.mp3`, document.baseURI).href;
  }

  /** Optional audio/manifest.json (array of names) avoids probing files that do not exist. */
  private getManifest() {
    if (!this.manifest) {
      this.manifest = fetch(new URL('audio/manifest.json', document.baseURI).href)
        .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
        .then((j) => (Array.isArray(j) ? new Set<string>(j.map(String)) : null))
        .catch(() => null);
    }
    return this.manifest;
  }

  private load(name: string): Promise<AudioBuffer | null> {
    const existing = this.loads.get(name);
    if (existing) return existing;
    this.state.set(name, 'loading');
    const p = (async () => {
      if (!this.ctx) return null;
      try {
        const man = await this.getManifest();
        if (man && !man.has(name)) throw new Error('not listed');
        const r = await fetch(this.url(name));
        const type = r.headers.get('content-type') ?? '';
        if (!r.ok || type.includes('text/html')) throw new Error('missing');
        const data = await r.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(data);
        this.buffers.set(name, buf);
        this.state.set(name, 'ok');
        return buf;
      } catch {
        this.state.set(name, 'missing');
        return null;
      }
    })();
    this.loads.set(name, p);
    return p;
  }

  private playBuffer(buf: AudioBuffer, bus: GainNode, loop = false, vol = 1) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(g).connect(bus);
    src.start();
    return src;
  }

  // ---------- sfx ----------

  sfx(name: SfxName) {
    if (!this.ctx || save.muted) return;
    const gap = SFX_GAP[name];
    if (gap) {
      const now = performance.now();
      if (now - (this.lastPlay.get(name) ?? -1e9) < gap) return;
      this.lastPlay.set(name, now);
    }
    if (SYNTH_ONLY.has(name)) {
      this.synth(name);
      return;
    }
    const st = this.state.get(name) ?? 'unknown';
    if (st === 'ok') {
      this.playBuffer(this.buffers.get(name)!, this.sfxBus, false, SFX_VOL[name] ?? 1);
      return;
    }
    if (st === 'unknown') this.load(name);
    this.synth(name);
  }

  // ---------- voice ----------

  /** Plays a voice line if its file exists; otherwise silently does nothing. One voice at a time. */
  voice(name: string) {
    if (!this.ctx) return;
    const st = this.state.get(name) ?? 'unknown';
    if (st === 'missing') return;
    const requested = performance.now();
    this.load(name).then((buf) => {
      if (!buf || save.muted) return;
      if (performance.now() - requested > 2500) return; // too late to be relevant
      this.stopVoice();
      const src = this.playBuffer(buf, this.voiceBus);
      this.voiceSrc = src;
      this.duck(true);
      src.onended = () => {
        if (this.voiceSrc === src) {
          this.voiceSrc = null;
          this.duck(false);
        }
      };
    });
  }

  /** voiceRandom('v_right', 6) picks v_right1..v_right6 without repeating the previous one. */
  voiceRandom(prefix: string, count: number) {
    const last = this.lastVoice.get(prefix);
    let name = last;
    for (let tries = 0; tries < 8 && name === last; tries++) name = `${prefix}${1 + Math.floor(Math.random() * count)}`;
    this.lastVoice.set(prefix, name!);
    this.voice(name!);
  }

  stopVoice() {
    if (this.voiceSrc) {
      try {
        this.voiceSrc.onended = null;
        this.voiceSrc.stop();
      } catch {
        /* already stopped */
      }
      this.voiceSrc = null;
      this.duck(false);
    }
  }

  private duck(on: boolean) {
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(on ? MUSIC_VOL * DUCK : MUSIC_VOL, this.ctx.currentTime, 0.12);
  }

  // ---------- music ----------
  // Places (menu, shop, camp1..camp5) each have a playlist (see musicPlaylist.ts). Long tracks STREAM through
  // HTMLAudioElements routed into the music bus (never decoded). One element normally, two during a crossfade.
  // No file for a place -> music.mp3 -> synth loop.

  private mActive = false;
  private mPlace: MusicPlace | null = null;
  private mWanted: MusicPlace | null = null;
  private mList: string[] | null = null;
  private mToken = 0;
  private mVoices: MusicVoice[] = [];
  private mAvail = new Map<string, boolean>();
  private mProbes = new Map<string, Promise<boolean>>();
  private mChain: number | null = null;

  /** Chooses the music place. Does nothing if that place is already playing; starts once music is on and audio is unlocked. */
  setMusic(place: MusicPlace) {
    this.mWanted = place;
    if (this.musicOn && this.ctx) void this.enterPlace(place);
  }

  startMusic() {
    this.musicOn = true;
    if (this.ctx) this.beginMusic();
  }

  stopMusic() {
    this.musicOn = false;
    this.mActive = false;
    this.mToken++;
    this.mPlace = null;
    this.mList = null;
    this.stopSynth();
    for (const v of [...this.mVoices]) this.fadeVoice(v, 0.2);
  }

  private beginMusic() {
    void this.enterPlace(this.mWanted);
  }

  /** Restarts a music element the browser paused (blocked play(), tab hidden/shown). */
  kickMusic() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
    for (const v of this.mVoices) if (!v.fading && v.el.paused && !v.el.ended) v.el.play().catch(() => undefined);
  }

  /** One HEAD request per file (no decoding): does audio/<name>.mp3 exist? */
  private probe(name: string): Promise<boolean> {
    let p = this.mProbes.get(name);
    if (!p) {
      p = fetch(this.url(name), { method: 'HEAD' })
        .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'))
        .catch(() => false)
        .then((ok) => {
          this.mAvail.set(name, ok);
          return ok;
        });
      this.mProbes.set(name, p);
    }
    return p;
  }

  private avail = (name: string): boolean | undefined => this.mAvail.get(name);

  /** Debug: what the music system is doing. */
  musicState() {
    const live = this.mVoices.filter((v) => !v.fading);
    const list = this.mList ?? [];
    return {
      wanted: this.mWanted,
      place: this.mPlace,
      on: this.musicOn,
      playing: live.length ? live[live.length - 1].name : null,
      list,
      mode: !this.mActive ? 'off' : this.musicTimer !== null ? 'synth' : isFallbackList(list) ? 'fallback' : list.length ? 'files' : 'loading',
      elements: this.mVoices.length,
      voices: this.mVoices.map((v) => ({ name: v.name, t: Math.round(v.el.currentTime * 10) / 10, paused: v.el.paused, fading: v.fading, gain: Math.round(v.gain.gain.value * 100) / 100 })),
      known: Object.fromEntries(this.mAvail),
    };
  }

  private async enterPlace(place: MusicPlace | null) {
    if (!this.ctx) return;
    if (this.mActive && place === this.mPlace) return;
    const token = ++this.mToken;
    this.mActive = true;
    this.mPlace = place;
    let list: string[];
    if (place) {
      await Promise.all(candidateTracks(place).map((n) => this.probe(n)));
      if (token !== this.mToken) return;
      list = playlistFor(place, this.avail);
      if (isFallbackList(list)) {
        await this.probe(FALLBACK_TRACK);
        if (token !== this.mToken) return;
        list = playlistFor(place, this.avail);
      }
    } else {
      await this.probe(FALLBACK_TRACK);
      if (token !== this.mToken) return;
      list = this.mAvail.get(FALLBACK_TRACK) === false ? [] : [FALLBACK_TRACK];
    }
    if (!needsSwitch(this.mList, list)) return; // same music already playing: no restart
    this.mList = list;
    if (!list.length) {
      for (const v of [...this.mVoices]) this.fadeVoice(v, CROSSFADE_S);
      this.startSynth();
      return;
    }
    this.stopSynth();
    this.startTrack(list[0], token);
  }

  private startTrack(name: string, token: number) {
    const c = this.ctx;
    if (!c) return;
    const loop = (this.mList?.length ?? 1) <= 1;
    const el = new Audio(this.url(name));
    el.preload = 'auto';
    el.loop = loop;
    const node = c.createMediaElementSource(el);
    const gain = c.createGain();
    gain.gain.value = 0;
    node.connect(gain).connect(this.musicBus);
    const live = this.mVoices.filter((v) => !v.fading);
    const fade = live.length ? CROSSFADE_S : 0.4;
    const t = c.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(MUSIC_TRACK_VOL, t + fade);
    const v: MusicVoice = { name, el, node, gain, fading: false, chained: false, timer: null };
    for (const o of live) this.fadeVoice(o, fade);
    // never more than two elements: a third request drops the oldest fading one at once
    const fading = this.mVoices.filter((x) => x.fading);
    while (fading.length > 1) this.releaseVoice(fading.shift()!);
    this.mVoices.push(v);
    el.addEventListener('error', () => {
      if (token !== this.mToken || v.fading) return;
      this.mAvail.set(name, false);
      this.releaseVoice(v);
      this.mList = null;
      this.mActive = false;
      void this.enterPlace(this.mPlace);
    });
    el.addEventListener('ended', () => {
      if (!loop && !v.fading && token === this.mToken) this.chainNext(v, token);
    });
    el.play().catch(() => undefined); // blocked until a gesture: kickMusic() retries
    if (!loop) this.ensureChainTimer(token);
  }

  /** Multi-track playlists: start the next track a crossfade before this one ends. */
  private ensureChainTimer(token: number) {
    if (this.mChain !== null) return;
    this.mChain = window.setInterval(() => {
      const v = this.mVoices.find((x) => !x.fading);
      if (!v || token !== this.mToken || !this.mActive) {
        if (!v && this.mChain !== null) {
          window.clearInterval(this.mChain);
          this.mChain = null;
        }
        return;
      }
      const d = v.el.duration;
      if (!v.chained && Number.isFinite(d) && d > 0 && d - v.el.currentTime <= CROSSFADE_S + 0.3) this.chainNext(v, token);
    }, 300);
  }

  private chainNext(v: MusicVoice, token: number) {
    if (v.chained) return;
    v.chained = true;
    const place = this.mPlace;
    const list = place ? playlistFor(place, this.avail) : [FALLBACK_TRACK];
    if (!list.length) return;
    this.mList = list;
    const next = list[nextIndex(list.indexOf(v.name), list.length)];
    this.startTrack(next, token);
  }

  private fadeVoice(v: MusicVoice, dur: number) {
    if (v.fading) return;
    v.fading = true;
    const c = this.ctx;
    if (c) {
      const g = v.gain.gain;
      const now = c.currentTime;
      const level = g.value;
      g.cancelScheduledValues(now);
      g.setValueAtTime(level, now);
      g.linearRampToValueAtTime(0, now + dur);
    }
    v.timer = window.setTimeout(() => this.releaseVoice(v), dur * 1000 + 150);
  }

  /** Stops the element and frees it (src cleared) so the stream and its buffers are dropped. */
  private releaseVoice(v: MusicVoice) {
    if (v.timer !== null) window.clearTimeout(v.timer);
    v.timer = null;
    try {
      v.el.pause();
      v.el.removeAttribute('src');
      v.el.load();
    } catch {
      /* ignore */
    }
    try {
      v.node.disconnect();
      v.gain.disconnect();
    } catch {
      /* ignore */
    }
    this.mVoices = this.mVoices.filter((x) => x !== v);
  }

  private startSynth() {
    if (this.musicTimer !== null || !this.ctx) return;
    this.musicNextTime = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  private stopSynth() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  // ---------- wind ----------

  startWind(level = 0.5) {
    if (!this.ctx) return;
    this.windBus.gain.setTargetAtTime(0.12 * level, this.ctx.currentTime, 0.8);
    if (this.windSrc) return;
    this.load('wind').then((buf) => {
      if (this.windSrc || !this.ctx) return;
      if (buf) {
        this.windSrc = this.playBuffer(buf, this.windBus, true, 2);
        return;
      }
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 500;
      bp.Q.value = 0.8;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain).connect(bp.frequency);
      src.connect(bp).connect(this.windBus);
      src.start();
      lfo.start();
      this.windSrc = src;
      this.windNodes = [bp, lfo, lfoGain];
    });
  }

  stopWind() {
    if (!this.ctx) return;
    this.windBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
  }

  // ---------- synthesis ----------

  private noiseBuffer() {
    if (!this.noise) {
      const c = this.ctx!;
      const len = c.sampleRate * 2;
      const b = c.createBuffer(1, len, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    return this.noise;
  }

  /** One enveloped oscillator note. */
  private tone(freq: number, t: number, dur: number, vol: number, type: OscillatorType = 'sine', bus?: GainNode, endFreq?: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseHit(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass') {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer();
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  private synth(name: SfxName) {
    const t = this.ctx!.currentTime + 0.01;
    const N = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    switch (name) {
      case 'correct':
        this.tone(N(88), t, 0.35, 0.35);
        this.tone(N(93), t + 0.09, 0.5, 0.3);
        this.tone(N(100), t + 0.09, 0.5, 0.08);
        break;
      case 'wrong':
        this.tone(190, t, 0.28, 0.32, 'triangle', undefined, 120);
        break;
      case 'gem':
        [84, 88, 91, 96, 100].forEach((m, i) => this.tone(N(m), t + i * 0.055, 0.3, 0.22));
        break;
      case 'present_shake':
        for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.08, 0.06, 0.35, 1800);
        break;
      case 'present_open':
        this.tone(380, t, 0.14, 0.4, 'sine', undefined, 950);
        [91, 95, 98, 103].forEach((m, i) => this.tone(N(m), t + 0.12 + i * 0.05, 0.3, 0.15));
        break;
      case 'step':
        this.noiseHit(t, 0.05, 0.12, 2600, 'highpass');
        break;
      case 'camp':
        [79, 84, 88, 91, 96].forEach((m, i) => {
          this.tone(N(m), t + i * 0.12, 0.6, 0.22);
          this.tone(N(m + 12), t + i * 0.12, 0.25, 0.05, 'triangle');
        });
        break;
      case 'win':
        [72, 76, 79, 84].forEach((m, i) => this.tone(N(m), t + i * 0.16, 0.35, 0.22, 'triangle'));
        this.tone(N(84), t + 0.7, 1.1, 0.25, 'triangle');
        this.tone(N(88), t + 0.7, 1.1, 0.15, 'sine');
        this.tone(N(91), t + 0.7, 1.1, 0.12, 'sine');
        break;
      case 'click':
        this.tone(900, t, 0.05, 0.18, 'sine', undefined, 700);
        break;
      case 'wind':
        this.noiseHit(t, 1.2, 0.1, 500);
        break;
      case 'bell':
        [96, 100, 103].forEach((m, i) => this.tone(N(m), t + i * 0.09, 0.9, 0.18));
        this.tone(N(108), t + 0.27, 1.1, 0.06, 'triangle');
        break;
      case 'buy':
        [84, 91, 96].forEach((m, i) => this.tone(N(m), t + i * 0.07, 0.25, 0.2, 'triangle'));
        break;
      case 'ice_crack':
        for (let i = 0; i < 4; i++) this.noiseHit(t + i * 0.06, 0.09, 0.4 - i * 0.07, 3000 - i * 500, 'highpass');
        break;
      case 'flurry':
        this.tone(N(98), t, 0.12, 0.14, 'sine', undefined, N(103));
        this.tone(N(101), t + 0.13, 0.14, 0.12, 'sine', undefined, N(106));
        break;
      case 'loose_gem':
        this.tone(N(96), t, 0.12, 0.09);
        this.tone(N(103), t + 0.04, 0.14, 0.06);
        break;
      case 'door':
        this.noiseHit(t, 0.35, 0.15, 400, 'lowpass');
        this.tone(N(67), t + 0.05, 0.3, 0.1, 'triangle', undefined, N(72));
        break;
      case 'tick':
        this.tone(N(91), t, 0.05, 0.05, 'square');
        this.noiseHit(t, 0.03, 0.05, 4000, 'highpass');
        break;
      case 'bounce':
        this.tone(220, t, 0.22, 0.25, 'sine', undefined, 660);
        break;
      case 'checkpoint':
        [86, 91, 98].forEach((m, i) => this.tone(N(m), t + i * 0.07, 0.4, 0.16, 'triangle'));
        break;
      case 'poof':
        this.noiseHit(t, 0.4, 0.22, 900, 'lowpass');
        this.tone(N(76), t + 0.1, 0.4, 0.08, 'sine', undefined, N(84));
        break;
      case 'puff':
        this.noiseHit(t, 0.18, 0.18, 1400, 'bandpass');
        break;
      case 'crumble':
        for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.07, 0.08, 0.16, 1600 - i * 300, 'bandpass');
        break;
    }
  }

  // 8-bar major pentatonic loop, eighth notes at 100 bpm. 0 = rest.
  private static MELODY = [
    67, 0, 69, 72, 74, 0, 72, 69, 67, 0, 64, 67, 69, 0, 0, 0,
    72, 0, 74, 76, 79, 0, 76, 74, 72, 0, 69, 72, 74, 0, 0, 0,
    76, 0, 74, 72, 69, 0, 72, 74, 67, 0, 69, 64, 62, 0, 0, 0,
    64, 0, 67, 69, 72, 0, 69, 67, 64, 0, 62, 64, 60, 0, 0, 0,
  ];
  private static BASS = [48, 53, 45, 43, 48, 53, 43, 48];

  private scheduleMusic() {
    if (!this.ctx || !this.musicOn) return;
    const c = this.ctx;
    const eighth = 60 / 100 / 2;
    const N = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    if (this.musicNextTime < c.currentTime - 1) this.musicNextTime = c.currentTime + 0.05; // tab was asleep
    while (this.musicNextTime < c.currentTime + 0.25) {
      const step = this.musicStep % AudioManager.MELODY.length;
      const t = this.musicNextTime;
      const m = AudioManager.MELODY[step];
      if (m) this.tone(N(m), t, eighth * 1.8, 0.5, 'triangle', this.musicBus);
      if (step % 8 === 0) {
        const b = AudioManager.BASS[(step / 8) % AudioManager.BASS.length];
        this.tone(N(b), t, eighth * 7, 0.45, 'sine', this.musicBus);
        this.tone(N(b + 7), t + eighth * 4, eighth * 3, 0.2, 'sine', this.musicBus);
      }
      this.musicNextTime += eighth;
      this.musicStep++;
    }
  }
}

export const audio = new AudioManager();
