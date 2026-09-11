# Patch 2.74.224

## Clipboard ability table compatibility

- The rich clipboard statblock now serializes the six ability headings as six explicit table data cells instead of HTML header cells.
- The ability table uses two ordinary rows inside one `tbody`: one row for `STR` through `CHA` and one row for the corresponding scores and modifiers.
- This avoids rich-text-to-Markdown converters that collapse consecutive `<th>` elements into the first column while keeping the score row split into six columns.
- Each copied ability cell has an explicit one-sixth width, padding, and centered alignment.
- The parallel plain-text clipboard representation keeps all six abilities on one readable line separated by middle dots, so pasting into `.txt` never depends on table columns, tabs, or spacing alignment.

## Regression coverage

- The frontend clipboard test parses the generated HTML and verifies two rows, six separate heading cells in the correct order, six value cells, and no `<th>` elements. It also verifies the exact single-line `STR`–`CHA` plain-text output.
