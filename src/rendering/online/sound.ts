/**
 * Online UI sounds. Every cue is synthesized with WebAudio (no audio files in the repository); `?sfx=<base url>` swaps in
 * files from that address instead (`<base>/<cue>.ogg`), falling back to the synthesized cue when a file fails.
 * Presentation only: cues follow what the page already shows and never feed back into commands or state.
 */
export type SoundCue = 'buy' | 'sell' | 'reroll' | 'xp' | 'levelUp' | 'starUp' | 'place' | 'prep' | 'choice' | 'combat' | 'tick' | 'hpLoss' | 'win' | 'lose';

const STORAGE_KEY = 'hex-online-sfx-muted';
const VOLUME = 0.22;
/**
 * One note: frequency (Hz), start offset and length (s), waveform, peak gain, optional glide target. `noise` is filtered white
 * noise (band-pass at the frequency) for card swishes, coin shimmer and drum hits; `bell` adds a quiet partial at 2.76× the
 * frequency for a metallic coin/chime ring.
 */
type Wave = OscillatorType | 'noise' | 'bell';
type Note = readonly [freq: number, at: number, length: number, wave: Wave, gain: number, glideTo?: number];
const CUES: Readonly<Record<SoundCue, readonly Note[]>> = {
  buy: [[1568, 0, .12, 'bell', .7], [2093, .045, .18, 'bell', .55], [6000, 0, .06, 'noise', .25]],
  sell: [[2093, 0, .1, 'bell', .55], [1568, .05, .1, 'bell', .5], [1319, .1, .22, 'bell', .45], [7000, .02, .14, 'noise', .2]],
  reroll: [[1800, 0, .2, 'noise', .5, 4200], [3000, .1, .14, 'noise', .35, 1500], [1046, .18, .08, 'triangle', .3]],
  xp: [[523, 0, .16, 'sine', .55, 1046], [2400, .02, .16, 'noise', .18, 5000]],
  levelUp: [[523, 0, .14, 'bell', .7], [659, .09, .14, 'bell', .7], [784, .18, .14, 'bell', .7], [1046, .27, .4, 'bell', .8]],
  starUp: [[1046, 0, .12, 'bell', .6], [1319, .07, .12, 'bell', .6], [1568, .14, .12, 'bell', .6], [2093, .21, .5, 'bell', .65], [8000, .2, .35, 'noise', .15]],
  place: [[180, 0, .06, 'sine', .55, 90], [2500, 0, .03, 'noise', .2]],
  prep: [[392, 0, .2, 'bell', .45], [587, .12, .32, 'bell', .45]],
  choice: [[659, 0, .2, 'bell', .45], [988, .1, .2, 'bell', .45], [1319, .2, .4, 'bell', .4]],
  combat: [[90, 0, .35, 'sine', .9, 45], [200, 0, .12, 'noise', .6], [140, .16, .3, 'sine', .6, 60], [220, .16, .1, 'noise', .4]],
  tick: [[1760, 0, .04, 'bell', .3]],
  hpLoss: [[160, 0, .3, 'sawtooth', .45, 60], [400, 0, .25, 'noise', .45, 150]],
  win: [[523, 0, .16, 'bell', .7], [659, .12, .16, 'bell', .7], [784, .24, .16, 'bell', .7], [1046, .36, .6, 'bell', .85]],
  lose: [[392, 0, .22, 'triangle', .6], [330, .2, .22, 'triangle', .6], [262, .4, .6, 'triangle', .6]],
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
  /** External files still playing, so muting or disposing stops them at once. */
  private readonly playing = new Set<HTMLAudioElement>();
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
  setMuted(muted: boolean): void { this.muted = muted; writeMuted(muted); if (muted) this.stopFiles(); }
  private stopFiles(): void { for (const audio of this.playing) audio.pause(); this.playing.clear(); }
  play(cue: SoundCue): void {
    const now = performance.now();
    if (now - (this.lastPlayed.get(cue) ?? -Infinity) < 60) return;
    this.lastPlayed.set(cue, now);
    this.played.push(cue); if (this.played.length > 50) this.played.shift();
    if (this.muted) return;
    if (this.fileBase && !this.failedFiles.has(cue)) {
      const audio = new Audio(`${this.fileBase}/${cue}.ogg`); audio.volume = VOLUME * 2;
      this.playing.add(audio); audio.addEventListener('ended', () => this.playing.delete(audio), { once: true });
      audio.play().catch(() => { this.playing.delete(audio); this.failedFiles.add(cue); if (!this.muted) this.synth(cue); });
      return;
    }
    this.synth(cue);
  }
  private noiseBuffer: AudioBuffer | null = null;
  /** One second of white noise, made once per context. */
  private noise(context: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      this.noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      // A fixed xorshift fills the buffer, so no Math.random() reaches the page.
      const data = this.noiseBuffer.getChannelData(0); let x = 0x9e3779b9;
      for (let i = 0; i < data.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; data[i] = (x >>> 0) / 2147483648 - 1; }
    }
    return this.noiseBuffer;
  }
  private synth(cue: SoundCue): void {
    const context = this.context; if (!context || context.state !== 'running') return;
    const start = context.currentTime + .01, noise = this.noise(context);
    const voice = (source: AudioScheduledSourceNode, input: AudioNode, at: number, length: number, gain: number) => {
      const amp = context.createGain();
      amp.gain.setValueAtTime(0.0001, start + at);
      amp.gain.exponentialRampToValueAtTime(VOLUME * gain, start + at + .006);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + at + length);
      input.connect(amp).connect(context.destination);
      source.start(start + at); source.stop(start + at + length + .02);
    };
    for (const [freq, at, length, wave, gain, glideTo] of CUES[cue]) {
      if (wave === 'noise') {
        const source = context.createBufferSource(), filter = context.createBiquadFilter();
        source.buffer = noise; filter.type = 'bandpass'; filter.Q.value = 1.2; filter.frequency.setValueAtTime(freq, start + at);
        if (glideTo) filter.frequency.exponentialRampToValueAtTime(glideTo, start + at + length);
        source.connect(filter); voice(source, filter, at, length, gain); continue;
      }
      const partials: readonly (readonly [number, number])[] = wave === 'bell' ? [[1, 1], [2.76, .3]] : [[1, 1]];
      for (const [ratio, level] of partials) {
        const osc = context.createOscillator();
        osc.type = wave === 'bell' ? 'sine' : wave; osc.frequency.setValueAtTime(freq * ratio, start + at);
        if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo * ratio, start + at + length);
        voice(osc, osc, at, ratio === 1 ? length : length * .5, gain * level);
      }
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
    this.stopFiles(); void this.context?.close().catch(() => undefined); this.context = null; this.noiseBuffer = null;
  }
}
