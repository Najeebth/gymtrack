export const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
