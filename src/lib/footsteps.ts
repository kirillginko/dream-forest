// Forest footstep SFX. Shares the music's AudioContext (via
// audioEngine.getContext()) but connects straight to the destination,
// bypassing the music analyser so steps don't pollute the audio-reactive
// visuals.

import { audioEngine } from "./audio";

const STEP_URL = "/sounds/step1.wav";

class Footsteps {
  private buffers: AudioBuffer[] = [];
  private loadPromise: Promise<void> | null = null;
  private gain: GainNode | null = null;
  private async load(ctx: AudioContext): Promise<void> {
    if (this.buffers.length > 0) return;
    if (!this.loadPromise) {
      this.loadPromise = fetch(STEP_URL)
        .then((res) => res.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
          this.buffers = [buffer];
        });
    }
    await this.loadPromise;
  }

  /** Play the forest footstep sound. */
  play(volume: number, rate: number): void {
    const ctx = audioEngine.getContext();
    if (this.buffers.length === 0) {
      void this.load(ctx);
      return; // first call just kicks off the decode; nothing to play yet
    }
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.connect(ctx.destination);
    }
    this.gain.gain.value = volume;
    const source = ctx.createBufferSource();
    source.buffer = this.buffers[0];
    source.playbackRate.value = rate;
    source.connect(this.gain);
    source.start();
  }
}

export const footsteps = new Footsteps();
