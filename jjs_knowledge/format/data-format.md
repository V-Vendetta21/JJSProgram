# Nested DATA Format

`DATA` is an outer-slot string containing JSON. The editor keeps both the outer slot and a parsed editable representation.

Observed top-level keys:

- `Line`: ordered array of node objects.
- `Req`: array of requirement objects.
- `Prop`: array **or** object; preserve the imported form.
- `Branch`: optional object keyed by exact branch name.

Observed branch value shape:

```json
{
  "Line": [],
  "Req": []
}
```

Confidence: **OBSERVED**. Completeness and runtime behavior remain unknown.
