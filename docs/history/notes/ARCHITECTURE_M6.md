# M6 architecture — deterministic dice interaction

M6 adds the first runtime interaction to product statblocks without changing parser or editable-document semantics.

## Boundary

Dice expressions are interpreted only while rendering or when the user explicitly enters an expression. `EditableBlock.text` is never rewritten or normalized by the dice layer.

```
EditableStatblockDocument
        ↓ render
findDiceExpressions(text)
        ↓
clickable source spans
        ↓
rollDice(expression)
        ↓
RollResult / UI history
```

The same `rollDice()` implementation is used for:

- inline `NdM±K` expressions;
- ability checks (`1d20 + ability modifier`);
- saving throws (`1d20 + usable save`);
- quick die buttons;
- the global free-form dice field.

Future initiative should reuse this engine instead of creating another random-roll implementation.

## Supported notation

The deterministic parser accepts Latin `d/D` and Ukrainian keyboard `к/К`:

- `d20`
- `1d20 + 3`
- `1к20+8`
- `3d6`
- `2d10-1`

Canonical display notation is `NdM±K` using `d`.

## Product safety

Dice interaction is presentation/runtime state only.

It does not:

- mutate statblock text;
- change working/saved/backup;
- invoke the parser or LLM;
- infer DC/save semantics from arbitrary prose.

Structured ability and saving-throw buttons come only from `StatblockFacts`.

## Roll history

M6 keeps a small in-memory history (latest ten rolls, five displayed). Persistence is intentionally deferred; losing roll history on reload is acceptable at this milestone.
