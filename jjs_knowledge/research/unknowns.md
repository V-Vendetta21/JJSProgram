# Research Unknowns

## UNKNOWN-001 — `Prop` representation

Seen in all three public samples as either an empty array or an object. Meaning of an empty array versus empty object and whether both are canonical is unknown.

Need: controlled in-game export comparison.

## UNKNOWN-002 — CHASE outer structure

Third-party library models `CHASE`, but no preserved genuine current sample contains it.

Need: export a custom front dash/chase slot from the current game.

## UNKNOWN-003 — Branch execution semantics

`Branch` object structure and arbitrary branch keys are observed. Exact trigger, nesting, missing-target, and origin behavior remain partially unknown.

Need: paired exports and in-game testing.

## UNKNOWN-004 — Required node fields

Occurrence frequency does not establish requiredness. Current validation warns but does not reject missing optional-looking fields.

Need: controlled minimal-node exports.

## UNKNOWN-005 — Historical uncompressed Base64 code

One community listing begins with Base64 for `[` rather than Zstandard magic. Whether this is a historical valid format, site corruption, or another code type is unknown.

Need: source provenance and in-game import test.

## UNKNOWN-006 — Runtime meaning of extreme values

Public community samples contain unusual/extreme numbers. Their in-game acceptance and behavior are not inferred.

Need: do not use as generation defaults; controlled testing only.

## UNKNOWN-007 — Current complete node/condition/property catalogs

The third-party library claims broad support, but public exports already show `PARTICLE`, which is absent from its June 2026 node implementation.

Need: current in-game inventory and new exports.
