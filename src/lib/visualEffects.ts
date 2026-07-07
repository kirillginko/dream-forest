/** Mutable render signal: lets gameplay and postprocessing react in the same
 * frame without waiting for a React render/effect cycle. */
export const liquidMorphSignal = {
  startedAt: -Infinity,
  pixelMode: false,
};

export function triggerLiquidMorph(pixelMode: boolean): void {
  liquidMorphSignal.startedAt = performance.now() / 1000;
  liquidMorphSignal.pixelMode = pixelMode;
}
