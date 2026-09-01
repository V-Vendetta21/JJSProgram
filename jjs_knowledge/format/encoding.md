# Character Code Encoding

## Current conclusion

```text
JJS code
→ standard Base64 decode
→ Zstandard decompress
→ UTF-8 decode
→ JSON parse
→ array of slot objects
```

Confidence: **VERIFIED** for the transformation through independent code inspection plus repeatable decoding of public samples.

## Safety limits

The studio rejects empty/invalid Base64, limits input code size to 8 MB, limits decompressed data to 32 MB, uses fatal UTF-8 decoding, and requires the outer JSON value to be an array of objects.

## Determinism

The encoded bytes are produced by ordinary code. The exact compressed Base64 string may vary with Zstandard library/version or compression settings even when decompressed JSON is equivalent. Validation therefore compares decoded JSON structure, not compressed string identity.

## Round trip

```text
slots + parsed DATA
→ serialize DATA strings
→ JSON.stringify outer array
→ UTF-8
→ Zstandard
→ Base64
→ decode again
→ structural equality
```

A passing round trip proves codec/format consistency, not in-game behavior.
