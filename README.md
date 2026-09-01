# JJS Moveset Studio

Private, local-first moveset development tooling for legitimate Jujutsu Shenanigans Skill Builder exports.

## Current release: Foundation / Phase 1

Working now:

- Base64 + Zstandard + UTF-8 + JSON import
- nested `DATA` parsing
- moveset explorer
- timeline inspection
- dynamic raw-field inspector edits
- Monaco raw JSON editing
- permissive validation and branch diagnostics
- deterministic statistics
- undo/redo
- local project download/open and browser autosave
- safe export with automatic encode → decode → structural comparison
- preservation of unknown fields

Not implemented yet: AI provider integration, node graph, 3D previews, advanced diff/snapshots/components, and full reference catalogs. The UI does not present these as complete.

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run build
```

## Knowledge foundation

Start at [`jjs_knowledge/README.md`](jjs_knowledge/README.md). Public research samples are preserved locally with source records and confidence labels.

## Security and privacy

- Imported movesets are data and are never evaluated.
- No telemetry or authentication.
- Imported movesets are processed locally.
- No API key is committed.
- Codec input and decompressed output are size-limited.
