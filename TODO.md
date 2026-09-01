# JJS Moveset Studio TODO

## DONE

- [x] Inspect repository (initially empty except Git metadata).
- [x] Establish `jjs_knowledge/` with confidence labels, sources, samples, catalogs, unknowns, conflicts, hypotheses, changelog, and permissive schemas.
- [x] Confirm and implement deterministic Base64 + Zstandard + UTF-8 + JSON codec.
- [x] Preserve and decode three representative public community exports.
- [x] Harvest slot/node/field/type/frequency observations.
- [x] Add genuine-sample round-trip tests.
- [x] Build Phase 1 React/TypeScript/Vite desktop editor shell.
- [x] Implement import, explorer, timeline, inspector, raw JSON, validation, stats, undo/redo, project file save/open, autosave, and verified export.

## IN PROGRESS

- [ ] In-game verification of generated codes (requires user testing in JJS).

## NEXT

- [ ] Add exact structural diff and snapshots.
- [ ] Add node insertion/deletion/reordering with dependency warnings.
- [ ] Add branch visualizer and requirement builder.
- [ ] Add schema discovery UI backed by current harvest reports.
- [ ] Add templates/components only after enough observed constructs exist.
- [ ] Add AI provider abstraction after deterministic Phase 1 acceptance criteria are validated with the user's own exports.
- [ ] Require rotated credentials via environment/local settings; never commit keys.

## KNOWN JJS UNKNOWNS

- `Prop` array versus object semantics.
- Complete required/optional field rules.
- Current raw `CHASE` export shape.
- Branch runtime semantics and nesting behavior.
- Historical uncompressed Base64 code support.
- In-game validity of external re-encoding.

## DISCOVERED FORMAT INFORMATION

- Outer root: array of slot objects.
- Slot `DATA`: serialized JSON object.
- Observed DATA keys: `Line`, `Req`, `Prop`, optional `Branch`.
- Observed slot types: `SKILL`, `SPECIAL`, `AWAKENING`, `MELEE`.
- Observed nodes: `WAIT`, `ANIM`, `HITBOX`, `SFX`, `VISUAL`, `VELO`, `SKILL`, `SPECIAL`, `HITCNCL`, `HPGIB`, `LOOP`, `PARTICLE`.

## BUGS

- None currently known after automated verification. In-game behavior remains unverified by design.
