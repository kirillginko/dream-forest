import { audioEngine } from "./audio";

type EffectName = "cat" | "chicken" | "transition" | "shard";

const URLS: Record<EffectName, string> = {
  cat: "/sounds/cat.wav",
  chicken: "/sounds/chicken.wav",
  transition: "/sounds/transition.wav",
  shard: "/sounds/shard.wav",
};

class SoundEffects {
  private buffers = new Map<EffectName, AudioBuffer>();
  private loading = new Map<EffectName, Promise<AudioBuffer>>();

  private load(name: EffectName): Promise<AudioBuffer> {
    const cached = this.buffers.get(name);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(name);
    if (pending) return pending;
    const ctx = audioEngine.getContext();
    const promise = fetch(URLS[name])
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(name, buffer);
        return buffer;
      });
    this.loading.set(name, promise);
    return promise;
  }

  preload(): void {
    (Object.keys(URLS) as EffectName[]).forEach((name) => { void this.load(name); });
  }

  play(name: EffectName, volume = 0.65, rate = 1): void {
    const ctx = audioEngine.getContext();
    void this.load(name).then((buffer) => {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    });
  }
}

export const soundEffects = new SoundEffects();
