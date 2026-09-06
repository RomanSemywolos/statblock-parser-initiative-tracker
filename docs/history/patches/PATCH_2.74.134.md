# v2.74.134 — Safe localized ability-table right-edge repair

## Problem

The v2.74.133 ownership-first multiline change correctly disabled broad deterministic source scanning for fixed Header fields. That exposed a weak-model edge case in the Hythonia Russian control sample: the verifier correctly identified the six localized ability labels (`Сил`, `Лов`, `Тел`, `Инт`, `Мдр`, `Хар`) and returned the correct semantic `ab` start, but ended the span on `Хар` instead of including the following printed value `18 (+4)`. Because `essentialOnly` required the exact proposed region to prove all six scores, the entire ability table was rejected. Source remained lossless, but the structured characteristics became null.

## Fix

Ownership-first multiline validation now permits one narrow deterministic repair class for verifier-owned ability evidence. The verifier's left edge is immutable. The right edge may advance only through complete physical source rows. Each candidate region is checked by the ordinary deterministic ability-table constraint solver. The first/smallest region that proves all six abilities is accepted, and scanning stops immediately.

This repairs a final-label/final-value truncation without reintroducing the v2.74.133 hazard where deterministic enrichment could continue into the following standalone Saving Throws or other metadata row to obtain a richer region. Legacy non-ownership recovery retains its richer-table policy.

## Regression coverage

- Added a localized unit regression matching the Russian vertical ability shape and proving that the accepted region ends at `18 (+4)` and excludes the following `Спасброски` row.
- Added a multiline pipeline regression reproducing the actual Hythonia verifier off-by-one (`ab` ending on `Хар`) and verifying all six structured scores, visible exact source, and non-consumption of the standalone save row.
- Full compiled suite: 525/525 passing.
- Global TypeScript 5.8.3 `tsc --noEmit`: passing.

## Architecture

No mixed or singleline behavior was migrated in this patch. This is a multiline correctness repair before beginning the mixed ownership-first conversion. See `ARCHITECTURE_HEADER_OWNERSHIP.md`.
