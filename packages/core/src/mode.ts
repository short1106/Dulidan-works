/**
 * The three working modes of Dulidan apps.
 *
 *   basic   big buttons, few actions, for beginners
 *   expert  everything, with menu bar and shortcuts
 *   pro     like expert, plus the April side panel
 *
 * Every feature declares the modes it is visible in. The document itself is
 * the same in every mode: switching only changes what the UI shows.
 */
export const MODES = ['basic', 'expert', 'pro'] as const

export type Mode = (typeof MODES)[number]

export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value)
}

/** Shortcut lists for feature declarations. */
export const ALL_MODES: readonly Mode[] = MODES
export const ADVANCED_MODES: readonly Mode[] = ['expert', 'pro']

export interface ModeScoped {
  /** Modes in which this feature is visible. */
  modes: readonly Mode[]
}

export function isAvailableIn(feature: ModeScoped, mode: Mode): boolean {
  return feature.modes.includes(mode)
}

/** Keeps only the features that are visible in the given mode. */
export function filterByMode<T extends ModeScoped>(features: readonly T[], mode: Mode): T[] {
  return features.filter((feature) => isAvailableIn(feature, mode))
}
