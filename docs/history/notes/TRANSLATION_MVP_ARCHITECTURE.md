# Translation MVP architecture

## Goal

Produce an editable Ukrainian working version from the English `EditableStatblockDocument` without giving a general-purpose MT service authority over source mechanics or product structure.

## Active pipeline

1. Clone the English editable document.
2. Deterministically localize closed/known structures:
   - structured Header labels and payload vocabularies;
   - semantic section headings;
   - known D&D terminology and safe grammar rules;
   - known feature-title metadata.
3. Protect mechanical atoms (`dice`, `DC`, signed bonuses, frequencies, numbers).
4. For BODY nodes that still contain English prose:
   - protect deterministic Ukrainian islands as ordered `KEEP_*` tokens;
   - send only that BODY-node text to the configured `TranslationProvider`;
   - require all `KEEP_*` tokens exactly once and in original order;
   - restore mechanics;
   - validate source mechanics and mechanic order.
5. If any provider/token/mechanic check fails, keep that one deterministic BODY fragment unchanged.
6. Refresh editable facts and save the Ukrainian version independently from English.

MT never changes node boundaries, Header ownership, section identity, parser evidence, or source bytes.

## Providers

### DeepL API — default

DeepL runs behind the local Node backend. Browser code never sees the API key.

Backend environment:

- `DEEPL_API_KEY` — required.
- `DEEPL_API_BASE_URL` — optional diagnostic/account override.

Backend proxy:

- `GET /api/translation/health`
- `POST /api/translation`

### LibreTranslate — local fallback

The existing `LibreTranslateProvider` remains available for a local/offline server. Its service URL is stored in app settings; no DeepL secret is involved.

## MVP acceptance plan

### Phase A — provider/safety integration (2.74.212)

- backend-only DeepL credential;
- health + translate proxy;
- honest provider UI;
- ordered deterministic-island protection;
- tests for provider transport and fallback safety.

### Phase B — live EN→UK corpus

Run representative parsed statblocks through DeepL and inspect:

- mechanic preservation;
- deterministic terminology preservation;
- placeholder survival;
- useful Ukrainian prose quality;
- fragment-local fallback rate;
- unsupported/awkward deterministic rules exposed by real prose.

### Phase C — only evidence-driven cleanup

Fix only concrete recurrent problems found by the live corpus. Prefer:

1. deterministic correction for closed D&D vocabulary/mechanics;
2. provider prompt/options only when they do not weaken safety;
3. manual editor correction for genuinely open stylistic language.

Do not expand regex translation into a second prose translator.

## Report-level success criteria

The translation MVP is acceptable when:

- no source mechanic is silently changed or lost;
- deterministic translated islands cannot be reordered by MT;
- standard Header/section vocabulary is localized;
- ordinary BODY prose is normally Ukrainian;
- provider failure degrades to visible deterministic/English fallback rather than corrupting the document;
- the Ukrainian working version remains editable and independently saveable;
- the provider/key architecture is documented and reproducible.
