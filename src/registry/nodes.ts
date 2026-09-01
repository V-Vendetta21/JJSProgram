export type Confidence = 'VERIFIED' | 'OBSERVED' | 'LIKELY' | 'ASSUMED' | 'UNKNOWN' | 'DEPRECATED'

export interface NodeDefinition {
  type: string
  label: string
  category: 'execution' | 'movement' | 'combat' | 'animation' | 'presentation' | 'logic' | 'resource'
  confidence: Confidence
  fields: readonly string[]
  source: string
}

const observed = (type: string, category: NodeDefinition['category'], fields: readonly string[]): NodeDefinition => ({
  type,
  label: type,
  category,
  confidence: 'OBSERVED',
  fields,
  source: 'Public exported samples in jjs_knowledge/examples',
})

export const nodeDefinitions: NodeDefinition[] = [
  observed('WAIT', 'execution', ['K_NAME', 'TIME']),
  observed('ANIM', 'animation', ['K_NAME', 'ANIM_USE', 'PREVIEW', 'SPEED', 'LOOPED', 'LAST HIT']),
  observed('HITBOX', 'combat', ['K_NAME', 'PREVIEW', 'DAMAGE', 'SIZE', 'POSITION', 'STUN', 'STUN ANIM', 'BLOCKABLE', 'SINGLE TARGET', 'HIT USER', 'HIT RAGDOLL', 'BRANCH', 'BRANCH TARGET', 'BRANCH FINISHER', 'PROJECTILE TAG']),
  observed('SFX', 'presentation', ['K_NAME', 'ID', 'VOLUME', 'SPEED', 'START', 'END', 'CANCEL']),
  observed('VISUAL', 'presentation', ['K_NAME', 'EFFECT', 'TIME', 'AMOUNT', 'TEXTURE', 'COLOR', 'ALT COLOR', 'OPACITY', 'ALT OPACITY', 'POSITION', 'ALT POSITION', 'SIZE', 'ALT SIZE', 'BODY PART', 'LAST HIT']),
  observed('VELO', 'movement', ['K_NAME', 'FORCE', 'TIME', 'RAGDOLL', 'TRUE RAGDOLL', 'LAST HIT']),
  observed('SKILL', 'execution', ['K_NAME', 'MOVE', 'SPEED', 'CANCEL LAST', 'ENABLE VARIANTS']),
  observed('SPECIAL', 'execution', ['K_NAME', 'SPEC', 'SPEED', 'ENABLE VARIANTS']),
  observed('HITCNCL', 'logic', ['K_NAME', 'TIME', 'FLIP', 'ENDLAG', 'BRANCH']),
  observed('HPGIB', 'resource', ['K_NAME', 'AMOUNT']),
  observed('LOOP', 'logic', ['K_NAME', 'LOOP BACK', 'LOOP AMOUNT', 'HOLD']),
  observed('PARTICLE', 'presentation', ['K_NAME', 'SIZE', 'PART SIZE', 'EMIT COUNT', 'TEXTURE', 'SHAPE', 'RATE', 'SPREAD ANGLE', 'FLIPBOOK MODE', 'DURATION', 'COLOR', 'ACCELERATION', 'BODY PART', 'EMISSION DIRECTION', 'ROTATION', 'FLIPBOOK SIZE', 'ROT SPEED', 'SPEED', 'TRANSPARENCY', 'ZOFFSET', 'FLIPBOOK FRAMERATE', 'LIGHT EMISSION', 'ORIENTATION TYPE', 'LIFETIME', 'LOCK TO PART', 'SQUASH', 'POSITION', 'BRIGHTNESS', 'LIGHT INFLUENCE', 'CLIENT SIDED', 'CANCEL', 'DRAG', 'SHAPE INOUT', 'LAST HIT', 'SHAPE PARTIAL', 'RUN ON SERVER', 'CANCEL ON INTERRUPT']),
]

export const nodeDefinitionMap = new Map(nodeDefinitions.map((definition) => [definition.type, definition]))
