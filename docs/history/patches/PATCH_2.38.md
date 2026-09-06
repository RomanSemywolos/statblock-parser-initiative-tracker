# v2.38 — edit-mode formatting parity and explicit header structure

## Automatic formatting is visible while editing

Presentation-only formatting is now hydrated into the editor as presentation-only DOM wrappers.

Two automatic styles are covered:

- known structured header labels such as `Armor Class`, `Hit Points`, `Damage Resistances`;
- short leading ability/action sentences such as `Fiendish Rot.`.

Those wrappers are marked `data-auto-format="true"`. The editor serializer deliberately ignores the
wrapper itself and serializes only its content, so automatic bold/italic does not become permanent
`**...**` / `*...*` authoring markup.

As a result, Edit mode shows the same automatic visual emphasis that returns in normal view, without
mutating the document.

## One bold weight

Automatic and manually-authored bold content inside a statblock now uses the same `font-weight: 700`.

The previous stronger semantic-field weight is removed, so switching between automatic and manual
formatting should no longer produce visibly different "degrees" of bold.

Section headings remain separate heading typography.

## Header model

Only the monster-name slot is structurally guaranteed.

- Name always exists, even when empty.
- Size/type/alignment is optional again.
- Existing empty subtitle slots created by v2.37 normalize back to `null`.
- A real non-empty subtitle is preserved.

The editor exposes two explicit controls:

- `+ Тип / світогляд` when the optional subtitle is absent;
- `+ Рядок хедера` for a generic header row.

This removes the need to use Enter as a hidden structure-creation command.

## Header Enter behavior

Enter is navigation only:

- name -> subtitle if present, otherwise first header row/body;
- subtitle -> first header row/body;
- header row -> next header row;
- final header row -> body.

It does not silently create another header row.

## Persistence

`ensureEditableHeaderSubtitle()` creates the optional subtitle slot only when explicitly requested.
Clearing that subtitle removes it again.

The existing continuous body editor and encounter snapshot semantics are unchanged.
