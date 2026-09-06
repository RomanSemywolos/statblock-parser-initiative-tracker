# Patch 2.74.208 — singleline Header ability anchors + source-proven overlap carve

## Why 2.74.207 was not ready to promote

The live 2.74.207 / qwen3:8b five-case corpus confirmed that the complete-fact coordinate transport is much closer to the intended mixed architecture, but it also exposed one unnecessary singleline-specific burden: the model was asked both to map all six printed ability labels **and** to guess the exact outer `ab` span in a physically collapsed stream.

That redundancy produced failures which deterministic code could already solve more safely:

- Astral Dreadnought and Demogorgon returned all six correct ability-label mappings but truncated the `ab` right edge before the complete table ended.
- Tarrasque returned the correct STR/DEX/INT/WIS/CHA label coordinates, mapped CON to the immediately following numeric score cell, truncated `ab`, and incorrectly emitted an `sv` span from the internal 2024 save-column layout.
- Tarrasque also started the HP claim on the final `(28)` token already owned by printed Initiative, even though the remainder of the HP claim was correct.

Other live 2.74.207 errors are deliberately **not** deterministically repaired here: several `sta` spans stopped before the full alignment phrase, Aspect of Tiamat misaddressed CR and selected only the PB value, Demogorgon selected only the PB value, Astral omitted printed PB, and Baphomet proposed a false PB inside the Challenge XP parenthetical. Those remain semantic/model-selection questions for the next live run rather than justification for language-specific or fuzzy recovery.

## 2.74.208 design

Singleline continues to use one dense, neutral `Cxxx=TOKEN` source view and coordinate-only output. Mixed remains unchanged on the accepted 2.74.202 baseline. BODY remains unchanged.

The Header responsibility split is now more specific to collapsed input:

`dense coordinate source -> scalar/identity fact spans + six semantic ability-label spans -> deterministic mechanical closure -> accepted Header ownership -> exact BODY complement`

### 1. Remove model-selected `ab` outer span from singleline

The singleline Header model no longer returns `ab` in `fields`.

It returns only:

- complete `name` / `size-type-subtype-alignment` spans;
- complete printed `ac`, separately printed `init`, `hp`, separately printed `sv`, `cr`, and printed `pb` spans;
- six printed ability-label spans mapped to `str/dex/con/int/wis/cha` when safe.

The exact ability region is reconstructed deterministically from the six model-supplied semantic label mappings plus the printed numeric cells. This reuses the same architecture principle already established in the shared ability resolver: the model owns **label identity**, deterministic code owns score/modifier/save cells and the exact region.

This removes a redundant geometry prediction that has no independent authority in a physically collapsed source.

### 2. Restore the established numeric-cell ability-coordinate repair

The project already had a language-neutral control rule: when a model maps a canonical ability to the immediately following numeric score/modifier cell instead of the printed label, deterministic code may probe exactly one candidate to the left, but only if the complete six-label mechanical solver independently proves the region.

2.74.208 applies that same rule inside the new singleline coordinate grounder.

It does **not** infer STR/DEX/etc. from printed vocabulary. Canonical identity still comes from the model's `a=str|dex|...` mapping. A numeric-coordinate repair becomes accepted evidence only if the full six-ability mechanics prove successfully.

This directly covers the live Tarrasque `con -> C033=30` error by testing the immediately preceding `C032=CON`; unrelated numeric anchors cannot pass merely because they have a word before them.

### 3. Source-proven scalar-prefix carve

A full-fact claim may begin on the final attached token of an already accepted previous scalar fact. The live Tarrasque response selected:

`(28) HP 697 (34d20 + 340)`

while `(28)` was already independently proven as part of `Initiative +18 (28)`.

For `init` / `hp` only, deterministic grounding may remove an overlapping prefix **only when that exact prefix is already accepted earlier Header evidence** and the remaining source begins at the next candidate boundary. The remainder must then independently pass the ordinary scalar mechanical verifier.

This is an ownership carve, not fuzzy boundary repair. No unowned neighboring source is annexed.

### 4. 2024 shape is now explicit in the singleline prompt

The prompt now includes a compact 2024-style example:

`STR 30 +10 +10 DEX 11 +0 +9 ...`

and states explicitly that the printed save column inside this six-ability region is **not** a separate `sv` fact.

The prompt also explicitly reminds the model that `sta` must include the complete printed alignment phrase. This is model guidance only; no STA-specific deterministic neighbor expansion is added.

## Isolation / unchanged behavior

Unchanged:

- mixed Header/BODY requests and deterministic mixed geometry;
- accepted mixed baseline 2.74.202;
- multiline path;
- singleline BODY candidate lattice, prompt, schema, model response and shared multiline BODY parser;
- exact BODY = complement of accepted Header ownership;
- no global `bodyStart`;
- no free-text Header quotes;
- no language dictionaries or English D&D vocabulary in correctness logic;
- no deterministic semantic repair of CR/PB/STA mistakes from the 2.74.207 live model response.

## Stored-response replay against the live 2.74.207 corpus

The exact five live 2.74.207 Header responses and exact stored BODY-start responses were replayed through 2.74.208 without changing model content.

Results:

- 5/5 exact source reconstruction;
- 5/5 remain exactly two model tasks (`header`, `body`);
- Astral and Demogorgon no longer produce an `ab` right-edge rejection: six correct mapped labels are sufficient for deterministic ability-region proof;
- Tarrasque now recovers `HP 697 (34d20 + 340)` by carving only the already-owned Initiative `(28)` prefix;
- Tarrasque repairs the CON semantic anchor from the numeric cell to the immediately preceding printed label, then proves the complete 2024 six-ability region including printed save cells;
- the live false Tarrasque `sv` claim remains explicitly rejected rather than being reinterpreted;
- Aspect CR/PB, Baphomet false PB, Demogorgon value-only PB and truncated 2.74.207 STA spans remain unresolved under stored replay, proving that 2.74.208 is not silently widening unrelated semantic authority.

Because the actual 2.74.208 prompt removes `ab`, adds the 2024 example, and clarifies full STA alignment, a new live qwen3:8b run is required. Stored-response replay proves deterministic behavior only.

## Evaluation rule

2.74.208 is an evaluation candidate, not yet an accepted singleline baseline.

Primary live targets:

1. Tarrasque: six ability-label mappings should stay on printed labels; no separate `sv` should be emitted for the internal save column. Even if CON still lands on the numeric cell, the deterministic one-step repair must recover only when the full region proves.
2. Tarrasque: HP should be accepted even if qwen repeats the Initiative `(28)` prefix.
3. Astral / Demogorgon: no model `ab` edge exists to truncate.
4. All pre-2024 cases: check whether explicit STA wording now includes the complete alignment phrase.
5. Printed PB/CR remain model-quality controls: no deterministic broadening should conceal wrong semantic selection.

If these controls hold, the singleline Header architecture is sufficiently clean to stop qwen3:8b-specific tuning and move to BODY normalization work.
