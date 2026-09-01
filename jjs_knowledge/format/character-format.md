# Character and Slot Format

The root value is an array. Each entry is preserved as a raw object.

```json
{
  "K_NAME": "SKILL",
  "NAME": "Example",
  "DATA": "{\"Line\":[],\"Req\":[],\"Prop\":[]}",
  "KEY": 1,
  "COOLDOWN": 0
}
```

The example is structural only. It does not declare every field required.

## Observed outer types

See `../slots/slot-types.json`.

## Lossless policy

- Preserve unknown keys and values.
- Preserve array order.
- Do not deduplicate repeated objects.
- Do not coerce strings to numbers merely because they look numeric.
- Do not normalize `Prop` between array and object forms.
