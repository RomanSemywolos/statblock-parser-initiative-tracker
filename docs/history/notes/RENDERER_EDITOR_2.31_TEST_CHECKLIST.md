# v2.31 manual regression checklist

1. Import a real statblock through the product UI.
2. Confirm there are no separate “ability checks” / “saving throws” button panels above the statblock.
3. Confirm STR/DEX/CON/INT/WIS/CHA appear as a six-column table in the statblock header.
4. Confirm all six saves appear in the statblock itself.
5. Click an ability modifier and a save modifier. Confirm the roll appears:
   - in global history;
   - immediately beside the clicked modifier as bold `(1к20+N)=RESULT`.
6. Click a signed attack/save/skill modifier such as `+12` in normal statblock text. Confirm it rolls `1к20+12`.
7. Confirm the `+ 6` inside `2d8 + 6` is not separately treated as a d20 modifier.
8. Confirm `Recharge 5–6` does not make `–6` clickable.
9. Click a dice expression such as `4d10`; confirm its result is also shown inline.
10. F5. Confirm inline results disappear but the SavedStatblock remains.
11. Enter Edit mode. Confirm:
    - no role/field/section metadata is shown on ordinary lines;
    - no merge/split buttons exist;
    - block borders/separators are absent;
    - the text reads as one continuous statblock page.
12. Confirm section headings have only a small heading-type chip.
13. Edit AC/HP/ability text and confirm deterministic facts/sidebar still update and survive F5.
14. Select text and use B/I; confirm it appears bold/italic directly in the editor, then exit editing and confirm formatting still renders.
15. Use H on a paragraph and confirm it renders as a heading; toggle again and confirm it becomes normal content.
16. Confirm explicit Save / Revert / Backup lifecycle still behaves as before.
