import type { GenerationPreferences } from './types'

export const DEFAULT_GENERATION_PREFERENCES: GenerationPreferences = {
  complexity: 'medium',
  moveLength: 'medium',
  balance: 'normal',
  preferExistingAnimations: true,
  allowObservedReferences: true,
  allowLikelyReferences: false,
  automaticallyRepair: true,
  automaticallyInsert: false,
  creative: false,
  strict: false,
}

const KEY = 'jjs-ai-generation-preferences-v1'

export function loadGenerationPreferences(storage: Pick<Storage, 'getItem'> = localStorage): GenerationPreferences {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return DEFAULT_GENERATION_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<GenerationPreferences>
    return { ...DEFAULT_GENERATION_PREFERENCES, ...parsed }
  } catch { return DEFAULT_GENERATION_PREFERENCES }
}

export function saveGenerationPreferences(preferences: GenerationPreferences, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(KEY, JSON.stringify(preferences))
}
