# Research Changelog

## 2026-09-01

- Confirmed Base64 → Zstandard → UTF-8 → JSON decoding against three public codes and one published library sample.
- Added deterministic browser/Node codec and round-trip tests.
- Preserved public Void, Kashimo, and Particle Template codes plus decoded JSON.
- Observed slot types: `SKILL`, `SPECIAL`, `AWAKENING`, `MELEE`.
- Observed node types: `WAIT`, `ANIM`, `HITBOX`, `SFX`, `VISUAL`, `VELO`, `SKILL`, `SPECIAL`, `HITCNCL`, `HPGIB`, `LOOP`, `PARTICLE`.
- Observed `Branch` object structure in the particle template.
- Recorded `Prop` array/object and `VISUAL.SIZE` type conflicts.
- Added frequency/type harvest reports for each preserved sample.
- Cross-checked the codec against an independent decoder implementation; recorded that its non-Zstandard fallbacks are generic conveniences, not JJS-format evidence.
- Recorded the libjjs `ANIMATION` default-key versus raw `ANIM` inconsistency.
- Added a fourth public Yuji code page as corroborating evidence without promoting it to a decoded fixture.
