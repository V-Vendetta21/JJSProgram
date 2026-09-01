# Research Conflicts

## CONFLICT-001 — `Prop` container type

- Public Void fixture: mostly object, once array.
- Public Kashimo fixture: both array and object.
- Public Particle Template fixture: array.
- libjjs generator emits an object.

Status: **UNRESOLVED**. Preserve imported representation. Do not normalize.

## CONFLICT-002 — Node catalog freshness

- June 2026 libjjs repository lists 22 raw node identifiers and does not include `PARTICLE`.
- August 2026 public template contains 35 `PARTICLE` nodes.

Status: **RESOLVED AS VERSION DRIFT**, not as proof either source is universally complete. Registry remains extensible.

## CONFLICT-003 — VISUAL `SIZE` type

Public Kashimo sample contains both number and string values for `VISUAL.SIZE`.

Status: **UNRESOLVED**. Validator accepts both and records a type conflict.

## CONFLICT-004 — libjjs animation default key

The pinned `libjjs/defaults.py` maps the default builder under `ANIMATION`, while `nodes.ANIMATION()` emits the raw discriminator `K_NAME: "ANIM"`.

Status: **LIBRARY INCONSISTENCY**. Never use `_NODE_BUILDERS` keys as automatic raw node identifiers; prefer emitted raw values and genuine exports.
