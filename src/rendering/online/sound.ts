/**
 * Online UI sounds. Every cue is synthesized with WebAudio (no audio files in the repository); `?sfx=<base url>` swaps in
 * files from that address instead (`<base>/<cue>.ogg`), falling back to the synthesized cue when a file fails.
 * Presentation only: cues follow what the page already shows and never feed back into commands or state.
 */
export type SoundCue = 'buy' | 'sell' | 'reroll' | 'xp' | 'levelUp' | 'starUp' | 'prep' | 'combat' | 'tick' | 'hpLoss' | 'win' | 'lose';

const STORAGE_KEY = 'hex-online-sfx-muted';
const VOLUME = 0.22;
/** One note: frequency (Hz), start offset and length (s), waveform, peak gain, optional glide target. */
type Note = readonly [freq: number, at: number, length: number, wave: OscillatorType, gain: number, glideTo?: number];
const CUES: Readonly<Record<SoundCue, readonly Note[]>> = {
  buy: [[880, 0, .07, 'triangle', .9], [1320, .05, .1, 'triangle', .7]],
  sell: [[660, 0, .08, 'triangle', .8], [440, .06, .12, 'triangle', .6]],
  reroll: [[300, 0, .14, 'sawtooth', .25, 900], [1200, .1, .06, 'triangle', .5]],
  xp: [[520, 0, .12, 'sine', .7, 780]],
  levelUp: [[523, 0, .12, 'triangle', .8], [659, .1, .12, 'triangle', .8], [784, .2, .25, 'triangle', .9]],
  starUp: [[784, 0, .1, 'sine', .8], [1047, .08, .1, 'sine', .8], [1568, .16, .3, 'sine', .7]],
  prep: [[440, 0, .18, 'sine', .6], [660, .12, .25, 'sine', .5]],
  combat: [[110, 0, .3, 'square', .5, 55], [220, 0, .12, 'sawtooth', .3]],
  tick: [[1000, 0, .05, 'square', .25]],
  hpLoss: [[180, 0, .25, 'sawtooth', .6, 70]],
  win: [[523, 0, .15, 'triangle', .8], [659, .12, .15, 'triangle', .8], [784, .24, .15, 'triangle', .8], [1047, .36, .45, 'triangle', .9]],
  lose: [[392, 0, .2, 'triangle', .7], [330, .18, .2, 'triangle', .7], [262, .36, .5, 'triangle', .7]],
};

function readMuted(): boolean { try { return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; } }
function writeMuted(muted: boolean): void { try { if (muted) localStorage.setItem(STORAGE_KEY, '1'); else localStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ } }
function readFileBase(): string | null {
  if (typeof window === 'undefined') return null;
  const base = new URLSearchParams(window.location.search).get('sfx');
  return base ? base.replace(/\/+$/, '') : null;
}

export class OnlineSound {
  private context: AudioContext | null = null;
  private muted = readMuted();
  private readonly fileBase = readFileBase();
  private readonly failedFiles = new Set<SoundCue>();
  /** Last time each cue started, so a burst of identical changes plays once. */
  private readonly lastPlayed = new Map<SoundCue, number>();
  readonly played: SoundCue[] = [];
  /** Browsers only start audio after a gesture; the context is created on the first pointer or key press. */
  private readonly unlock = () => {
    if (!this.context && typeof AudioContext !== 'undefined') { try { this.context = new AudioContext(); } catch { this.context = null; } }
    void this.context?.resume().catch(() => undefined);
  };
  constructor() {
    document.addEventListener('pointerdown', this.unlock, true); document.addEventListener('keydown', this.unlock, true);
  }
  get isMuted(): boolean { return this.muted; }
  setMuted(muted: boolean): void { this.muted = muted; writeMuted(muted); }
  play(cue: SoundCue): void {
    const now = performance.now();
    if (now - (this.lastPlayed.get(cue) ?? -Infinity) < 60) return;
    this.lastPlayed.set(cue, now);
    this.played.push(cue); if (this.played.length > 50) this.played.shift();
    if (this.muted) return;
    if (this.fileBase && !this.failedFiles.has(cue)) {
      const audio = new Audio(`${this.fileBase}/${cue}.ogg`); audio.volume = VOLUME * 2;
      audio.play().catch(() => { this.failedFiles.add(cue); this.synth(cue); });
      return;
    }
    this.synth(cue);
  }
  private synth(cue: SoundCue): void {
    const context = this.context; if (!context || context.state !== 'running') return;
    const start = context.currentTime + .01;
    for (const [freq, at, length, wave, gain, glideTo] of CUES[cue]) {
      const osc = context.createOscillator(), amp = context.createGain();
      osc.type = wave; osc.frequency.setValueAtTime(freq, start + at);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + at + length);
      amp.gain.setValueAtTime(0.0001, start + at);
      amp.gain.exponentialRampToValueAtTime(VOLUME * gain, start + at + .01);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + at + length);
      osc.connect(amp).connect(context.destination); osc.start(start + at); osc.stop(start + at + length + .02);
    }
  }
  /** A small mute toggle; the caller places it. */
  createToggle(): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'sound-toggle'; button.dataset.debug = 'online:sound';
    const sync = () => { button.textContent = this.muted ? '音效 关' : '音效 开'; button.setAttribute('aria-pressed', String(!this.muted)); button.title = this.muted ? '打开界面音效' : '关闭界面音效'; };
    button.addEventListener('click', () => { this.setMuted(!this.muted); sync(); });
    sync(); return button;
  }
  dispose(): void {
    document.removeEventListener('pointerdown', this.unlock, true); document.removeEventListener('keydown', this.unlock, true);
    void this.context?.close().catch(() => undefined); this.context = null;
  }
}
