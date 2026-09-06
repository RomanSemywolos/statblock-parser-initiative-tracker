# Header transport regression analysis — 2.74.169

## Scope

This note records the remaining semantic differences observed in the 2.74.168
shadow corpus after the inline `[s,e)` adapter and lossless structural-class
compression were introduced. It does not authorize a parser behavior change.

## Corpus classification

The 13-report 2.74.168 run contained:

- 5 exact validated-Header matches;
- 4 additional functional matches whose evidence route/span bookkeeping differed;
- 1 case where shadow recovered a valid Header fact omitted by that legacy model run;
- 3 genuine shadow semantic regressions.

The three regressions are intentionally kept as fixtures:

1. **Beledros** — publication row followed by wrapped STA. Shadow stops STA after
   the size row (`Громадный?`) instead of including the following classification row.
2. **Hythonia** — publication row (`MOT`) is mistaken for STA while the actual
   wrapped classification begins on following rows.
3. **Cradle** — publication row (`BPGG`) is included in the printed name, even
   though shadow correctly recovers the printed PB later in the Header.

## Legacy vs inline information audit

No missing deterministic evidence was found in the inline transport for this
source class.

Legacy Header transport presents:

- the complete raw source once;
- a second `STRUCTURAL PROPOSALS` list where every candidate is rendered as a
  separate `Cxxx: preview` item;
- no Header `SOURCE-SHAPE HINTS` because `verificationHints()` is intentionally
  empty.

The 2.74.168 inline transport presents:

- the complete raw source once with candidate markers inserted at the same exact
  candidate offsets;
- the same existing boundary/continuation evidence, compressed losslessly into
  structural-class ids plus one legend;
- the same fixed Header semantic contract;
- explicit `[s,e)` marker semantics.

Therefore the remaining publication/wrapped-STA regressions cannot currently be
explained by deterministic information loss. The meaningful presentation change
is that legacy duplicates candidate text into a visually explicit proposal list,
while inline transport asks the model to interpret the same coordinates directly
inside the source flow.

That distinction can change model attention/stochastic behavior, especially on
short publication-code rows between a name and a wrapped classification, but it
is not evidence that the parser should learn publication vocabulary or add a new
semantic rule.

## Constraint for the next step

Do not add deterministic recognition for `SCC`, `MOT`, `BPGG`, publication codes,
size words, creature types, or alignment words. Doing so would violate the active
language-neutral parser contract and would invent new functionality during a
transport migration.

Any future change aimed at these regressions should first be tested as a
transport/presentation change that preserves exactly the same candidate/evidence
information.
