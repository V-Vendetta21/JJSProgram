# Current JJS Knowledge Status

Last research date: **2026-09-01**

> Confidence vocabulary: `VERIFIED`, `OBSERVED`, `LIKELY`, `ASSUMED`, `UNKNOWN`, `DEPRECATED`. `OBSERVED` means the shape exists in a preserved public export; it does not prove complete runtime semantics.

## Codec

**Status: VERIFIED for the transformation; GAME UNVERIFIED for newly generated content.**

Observed character codes are standard Base64 text whose decoded bytes begin with the Zstandard frame magic `28 B5 2F FD`. Decompressing yields UTF-8 JSON. The implemented reverse pipeline is:

```text
array of slot objects → JSON UTF-8 → Zstandard → Base64
```

The local TypeScript codec decoded three public codes and a published libjjs sample, then encoded and decoded its own output with structural equality. It never asks an LLM to produce compressed bytes.

## Outer Format

The decoded root is an array of slot objects. Public samples currently preserve these recurring fields without treating all of them as required:

- `K_NAME`: slot type string
- `NAME`: display name
- `DATA`: serialized JSON string
- type-dependent observed fields such as `KEY`, `COOLDOWN`, `ADD`, `DURATION`, `DELAY`, and `TOOL TIP`

Unknown outer fields are preserved.

## DATA

`DATA` is a JSON string. In the editor it is parsed into an object and serialized back only for export/editing. Across current samples:

- `Line`: ordered node array (`OBSERVED`)
- `Req`: array (`OBSERVED`)
- `Prop`: **array or object** (`OBSERVED CONFLICT`; do not normalize)
- `Branch`: optional object mapping exact branch names to objects containing `Line` and `Req` (`OBSERVED`)

Timeline array order is preserved. Object field order and whitespace are not claimed to be game-significant.

## Known Slot Types

Observed in preserved public exports:

- `SKILL`
- `SPECIAL`
- `AWAKENING`
- `MELEE`

`CHASE` appears in the third-party libjjs implementation and is `LIKELY`, but has not yet been observed in the three preserved public fixtures.

## Known Nodes

Observed in preserved public exports:

`WAIT`, `ANIM`, `HITBOX`, `SFX`, `VISUAL`, `VELO`, `SKILL`, `SPECIAL`, `HITCNCL`, `HPGIB`, `LOOP`, `PARTICLE`.

Exact field/type/occurrence evidence is under `research/observations/*.harvest.json`. These catalogs are permissive and incomplete.

## Branches

The particle-template export contains `Branch` as an object whose exact keys map to branch data containing `Line` and `Req`. Branch names include arbitrary text and numeric-looking strings, so the studio preserves them exactly. Runtime trigger semantics are not inferred merely from the names.

## Unknowns and Conflicts

- `Prop` appears as both an array and an object.
- Completeness and exact semantics of node fields remain unknown.
- Whether arbitrary Base64-only (uncompressed) historical codes are still accepted is unknown.
- `CHASE` raw structure needs a current genuine export.
- Game compatibility of codes generated outside JJS is unverified until tested in-game.
- Public sample provenance is community-supplied; authenticity is strong enough for `OBSERVED`, not `VERIFIED` behavior.

See `research/unknowns.md`, `research/conflicts.md`, and `research/hypotheses.md`.

## Validity Levels

The project reports these separately:

- `PARSE VALID`
- `CODEC VALID`
- `SCHEMA VALID` (permissive registry)
- `REFERENCE VALID`
- `GAME UNVERIFIED`
- `GAME VERIFIED` only after actual in-game testing

## Sources

Source records with access date and supported claim are in `research/sources.json`.

Primary initial evidence:

1. Public community codes and code pages from JJS Builder (three codes preserved and decoded locally; a fourth page recorded as corroboration).
2. FormunaGit/libjjs source and published sample (codec implementation and a decoded structural example).
3. An independent decoder that recognizes Zstandard framing and preserves raw JSON separately from display-only nested expansion.
4. Public Skill Builder overviews describing Timeline, Conditions, and Properties (supporting UI context only, not raw schema authority).

Important source caution: generic gzip/zlib/LZMA/Brotli fallbacks in an independent decoder are not evidence that JJS exports use those codecs. Current JJS-specific evidence supports Zstandard.

## Privacy

All preserved codes and decoded samples are processed locally. They must not be uploaded or published by this project. No API key is committed. Imported moveset strings are data and are never evaluated.
