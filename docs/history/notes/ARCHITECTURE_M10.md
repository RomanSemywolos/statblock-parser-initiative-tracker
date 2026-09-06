# M10 — encounter card configuration

M10 activates the `CardConfig` model introduced in M1.

```ts
type CardConfig = {
  showName: boolean;
  showArmorClass: boolean;
  showSavingThrows: boolean;
  customBlockIds: string[];
};
```

`HP` and initiative are not normal checkbox fields. They remain live encounter-owned controls whenever the corresponding combat state is available.

A separate `Налаштувати картку` mode is mutually exclusive with statblock editing. It exposes the built-in name/AC/saves toggles and checkboxes for other logical blocks. Built-in HP, initiative, AC, saving throws, and name blocks are excluded from the custom list to prevent duplicates.

Custom fields store only stable `EditableBlock.id` values. Rendering resolves each ID against the current English working document, so later text edits appear on the card automatically without rewriting `CardConfig`.

If a referenced block disappears after a merge/split, the missing ID is ignored during render. A later cleanup pass may prune stale IDs, but stale references never break the card.

Long custom fields render as a one-line ellipsized preview. The complete text is exposed through the browser hover title.
