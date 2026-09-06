# Patch 2.68.1

Fixes a TypeScript inference error in the single-line numbered-list marker collector introduced in 2.68.0.

`Array.from(...).flatMap(...)` inferred the callback from the first discriminated-literal branch (`kind: "number"`) and rejected the `kind: "letter"` branch under the project's real TypeScript build. The collector now uses an explicitly typed `CollapsedListMarker[]` plus a simple `for...of` loop, preserving the exact runtime behavior while making the discriminated union unambiguous to TypeScript.

No parser behavior or UI behavior is intentionally changed from 2.68.0.
