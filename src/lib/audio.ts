// Web Audio analysis engine. One instance for the whole app.
// Levels are written into a mutable object that the 3D scene reads every
// frame (no React re-renders at audio rate).

import { useDreamStore } from "./store";

export type AudioSource = "none" | "music";

export interface AudioLevels {
  bass: number;
  mid: number;
  treble: number;
  amplitude: number;
}

/** Smoothed 0..1 band energies, mutated in place every animation frame. */
export const audioLevels: AudioLevels = {
  bass: 0,
  mid: 0,
  treble: 0,
  amplitude: 0,
};

/** The soundtrack — every track in public/music, played in shuffled loop. */
const MUSIC_TRACKS = [
  "/music/Dreamscape.mp3",
  "/music/Dreamscape 2.mp3",
  "/music/Dreaming in the Machine.mp3",
  "/music/Neon Circuit.mp3",
  "/music/Neon Circuit 2.mp3",
  "/music/Neon Circuit 3.mp3",
];

const FFT_SIZE = 1024;

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** "/music/Dreamscape 2.mp3" -> "Dreamscape 2" */
function trackLabelFromUrl(url: string): string {
  const file = decodeURIComponent(url.split("/").pop() ?? "");
  return file.replace(/\.[^./]+$/, "");
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private raf = 0;
  private audioEl: HTMLAudioElement | null = null;
  private mediaNode: MediaElementAudioSourceNode | null = null;
  private playlist: string[] = [];
  private trackIndex = 0;
  source: AudioSource = "none";

  /** Shared AudioContext for one-off SFX (footsteps, etc) — same context
   * the music runs through, just without touching the music analyser. */
  getContext(): AudioContext {
    return this.ensureContext();
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.75;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.connect(this.ctx.destination);
      this.startLoop();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private startLoop() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (!this.analyser || !this.freqData || !this.ctx) return;
      this.analyser.getByteFrequencyData(this.freqData);
      const binHz = this.ctx.sampleRate / FFT_SIZE;
      const avg = (fromHz: number, toHz: number) => {
        const a = Math.max(1, Math.floor(fromHz / binHz));
        const b = Math.min(this.freqData!.length - 1, Math.ceil(toHz / binHz));
        let sum = 0;
        for (let i = a; i <= b; i++) sum += this.freqData![i];
        return sum / ((b - a + 1) * 255);
      };
      const bass = avg(25, 220);
      const mid = avg(220, 2200);
      const treble = avg(2200, 9000);
      const amp = bass * 0.5 + mid * 0.35 + treble * 0.15;
      const k = 0.18; // smoothing
      audioLevels.bass += (bass - audioLevels.bass) * k;
      audioLevels.mid += (mid - audioLevels.mid) * k;
      audioLevels.treble += (treble - audioLevels.treble) * k;
      audioLevels.amplitude += (amp - audioLevels.amplitude) * k;
    };
    tick();
  }

  private playCurrentTrack() {
    if (!this.audioEl || this.playlist.length === 0) return;
    const url = this.playlist[this.trackIndex];
    this.audioEl.src = encodeURI(url);
    void this.audioEl.play();
    useDreamStore.getState().setTrackLabel(trackLabelFromUrl(url));
  }

  private advanceTrack = () => {
    this.trackIndex = (this.trackIndex + 1) % this.playlist.length;
    // Reshuffle once we've cycled the whole playlist, so it doesn't repeat
    // in the same order forever.
    if (this.trackIndex === 0) this.playlist = shuffled(MUSIC_TRACKS);
    this.playCurrentTrack();
  };

  private retreatTrack = () => {
    this.trackIndex = (this.trackIndex - 1 + this.playlist.length) % this.playlist.length;
    this.playCurrentTrack();
  };

  /** Start (or resume) the looping soundtrack from public/music. */
  usePlaylist() {
    if (this.source === "music") return;
    const ctx = this.ensureContext();

    if (!this.audioEl) {
      const el = new Audio();
      el.crossOrigin = "anonymous";
      el.addEventListener("ended", this.advanceTrack);
      el.addEventListener("play", () => useDreamStore.getState().setMusicPlaying(true));
      el.addEventListener("pause", () => useDreamStore.getState().setMusicPlaying(false));
      this.mediaNode = ctx.createMediaElementSource(el);
      this.mediaNode.connect(this.analyser!);
      this.audioEl = el;
    }

    this.playlist = shuffled(MUSIC_TRACKS);
    this.trackIndex = 0;
    this.playCurrentTrack();
    this.source = "music";
  }

  /** Toggle play/pause. Starts the playlist from scratch if never started. */
  togglePlay() {
    if (this.source !== "music" || !this.audioEl) {
      this.usePlaylist();
      return;
    }
    if (this.audioEl.paused) void this.audioEl.play();
    else this.audioEl.pause();
  }

  /** Skip to the next track in the shuffled playlist. */
  next() {
    if (this.source !== "music") {
      this.usePlaylist();
      return;
    }
    this.advanceTrack();
  }

  /** Go back to the previous track in the shuffled playlist. */
  previous() {
    if (this.source !== "music") {
      this.usePlaylist();
      return;
    }
    this.retreatTrack();
  }

  dispose() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeEventListener("ended", this.advanceTrack);
    }
    this.mediaNode?.disconnect();
    this.audioEl = null;
    this.mediaNode = null;
    this.source = "none";
    cancelAnimationFrame(this.raf);
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
  }
}

export const audioEngine = new AudioEngine();
