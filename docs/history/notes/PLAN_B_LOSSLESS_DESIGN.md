> **Актуальний runtime (sparse candidate-span experiment).** Історичний текст нижче
> описує попередні Plan B transports. Поточна збірка лишає мовно-нейтральну
> candidate lattice, але модель повертає незалежні `blocks[{k,s,e,v?}]`. Повне
> покриття candidate-сітки не потрібне; кожен span валідовується окремо, а gaps
> зберігаються losslessly. Конкретний subtype `h` модель не генерує: його може
> підтвердити лише deterministic header semantic layer після grounding. Source
> fragments відновлює тільки код з `rawSource`.

# План Б: lossless-імпорт із природним структурним читанням

Дата початку: 2026-08-17

Статус: напівфінальна структурна збірка. Lossless source, token-exact anchoring,
source-backed представлення і мінімальний локальний web preview з безпечною
редагованою presentation-копією реалізовано. Інтерактивні mechanics та
підтверджуване редагування структури залишаються наступними шарами.

## 1. Мета

План Б розділяє дві різні вимоги:

1. Імпорт не має втрачати або змінювати жодного символу джерела.
2. Система має створити корисну структуру й згодом інтерактивні mechanics.

Перша вимога є жорстким інваріантом коду. Друга є перевірюваним enrichment,
який може бути неповним або виправленим людиною без пошкодження першоджерела.

## 2. Чому модель знову читає звичайний текст

Попередній експеримент вимагав від qwen3:8b працювати з сотнями синтетичних
`unit-N` маркерів, рахувати координати й одночасно дотримуватися суворої JSON
grammar. Це змінило просту семантичну задачу на низькорівневу індексацію та
спричинило repetition, truncation і grammar failures.

У плані А та сама модель значно краще виконувала природне структурне читання:
розпізнавала header, sections і повні features. Порівняння показало важливу
деталь: план А давав їй окремі top-level arrays `traits`, `actions`,
`bonusActions` тощо. Перша версія плану Б замінила їх універсальним
`sections[]`, через що модель мусила одночасно вирішувати тип секції, порядок
section objects і роль кожної quote. На Arasta це призвело до систематичного
пропуску чотирьох простих traits, хоча складніші features були прочитані.

Поточний pipeline повертає моделі перевірений affordance плану А, але не
повертає його ризик: модель не створює переписаний monster object і не витягає
mechanics. Вона бачить оригінал без адресних маркерів і повертає:

- `header[]` — field та повна дослівна `sourceQuote`;
- `sectionHeadings[]` — standard section та exact heading quote;
- `sectionRules[]` — section та повна introductory rules quote;
- `traits[]`, `actions[]`, `bonusActions[]`, `reactions[]`,
  `legendaryActions[]`, `mythicActions[]`, `lairActions[]` — об'єкти з exact
  `nameQuote` і повною exact `sourceQuote` у фіксованих кошиках;
- `supplementaryQuotes[]` — повні додаткові source blocks поза core sections.

`section_content` лишається внутрішньою консервативною роллю коду, але
`sectionContent[]` прибрано з активної generation schema: універсальний кошик
провокував qwen3:8b повторювати там ті самі features. Legacy-відповіді з ним
приймаються, а точні міжкошикові дублікати згортаються до найточнішої ролі.

Код знаходить ці quotes в immutable source й сам обчислює координати.
Окрема `nameQuote` повертає корисну властивість Plan A: модель явно називає
початок feature, тому continuation paragraph не потребує штучного імені й
залишається всередині попередньої повної `sourceQuote`. Код додатково перевіряє,
що `nameQuote` є точним token-prefix повної цитати. Legacy string items
залишаються прийнятними лише для читання вже збережених результатів.

## 3. Джерела істини

| Рівень | Що містить | Статус істини |
|---|---|---|
| `rawSource` | Точний прочитаний текст | Первинна незмінна істина |
| `sourceMap.units` | Безперервне механічне розбиття source | Детерміновано перевіряється |
| model quotes | Запропоновані повні source fragments | Лише evidence для пошуку |
| `annotations` | Роль + exact source span + provenance | Текст grounded; semantic role може бути model-proposed або deterministic section ownership |
| `blocks` | Повний source partition | Детерміновано компілюється |
| `normalized.txt` | Source-backed presentation | Похідний layout |

## 4. Жорсткі інваріанти

### B1. Незмінність джерела

`rawSource` зберігається саме так, як його повернув UTF-8 reader. Пробіли,
лапки, тире, регістр, CRLF/LF, таби й пунктуація не нормалізуються в source.

Поточний контракт гарантує точність прочитаного JavaScript-рядка. Для майбутньої
байтової гарантії можна додати raw-byte artifact і metadata декодування.

### B2. Повне розбиття

Source units утворюють точний partition `[0, rawSource.length)` без gaps і
overlaps. Кожна unit перевіряє власний `rawSource.slice(start, end)`, а їхня
конкатенація мусить дорівнювати `rawSource`.

Tokenizer навмисно механічний: чергування whitespace і non-whitespace runs.
Йому не потрібен список D&D labels або можливих формулювань.

### B3. Модель не визначає фінальний текст

Модельна quote — лише пошукове evidence. Прийнята quote повинна:

- бути непорожньою;
- мати точну послідовність усіх non-whitespace source units у `rawSource`;
- починатися й закінчуватися на межах source content units;
- належати до region заявленого header або section;
- не дублювати singular header field або standard section.

Після anchoring текст блока створюється тільки кодом через
`rawSource.slice(start, end)`.

Якщо модель повернула exact quote як supplementary, але span повністю лежить
між grounded standard section heading і наступним standard heading, код може
довести її section ownership без D&D-regex або назви feature. Такий block стає
`section_content`: він уже не top-level supplementary, але ще не називається
`feature` чи `section_rules` без доказу.

Якщо модель повністю пропустила змістовний source gap між двома grounded
standalone headings, код так само може довести лише його section ownership.
Він зберігає весь gap одним `section_content`, не розрізаючи реченнями,
порожніми рядками чи списком можливих feature names. Для collapsed/monolithic
input recovery дозволено лише тоді, коли обидві межі region незалежно доведені
як окремі source lines; інакше gap лишається `unclassified`.

Коли модель одночасно повернула окремі exact features і один широкий
`sectionRules`/`sectionContent`, що їх перекриває, код віддає ownership точним
feature boundaries із fixed bucket. Це не залежить від назв traits або їхньої
механіки: пріоритет визначається structural specificity. Широкий конфліктний
claim відхиляється з окремою діагностикою.

Якщо надрукованого heading Traits немає, але grounded header закінчується до
першого standard heading, код створює лише внутрішній implicit traits-region.
Він не додає у source штучного слова Traits, але дозволяє чесно закріпити
перед-Actions features за стандартною секцією.

Якщо exact standalone heading тієї самої секції помилково потрапив у
`sectionRules`, код може безпечно виправити лише його role. Текст, section і
source span при цьому не змінюються.

### B4. Жодного fuzzy trust path

Основний trust path не підміняє words, numbers, apostrophes, dashes або
punctuation і не застосовує semantic/fuzzy matching. Якщо quote була
перефразована, кандидат відхиляється.

Дозволяється лише whitespace-equivalent anchoring: усі non-whitespace units
мусять дослівно збігатися й бути послідовними, тоді як `CRLF`/`LF`, tabs/spaces
та розмір whitespace runs можуть відрізнятися. Прийнятий block однаково
вирізається з raw source з його справжнім whitespace.

Outer separator whitespace можна відкинути лише з модельної evidence quote;
в raw source і block partition він залишається exact separator.

### B5. Явна невизначеність

Кожен source fragment стає:

- annotated block;
- separator;
- або `unclassified`.

Для section-owned annotations окремо існує `section_content`: секція доведена
позиційно, а вужчий підтип навмисно не вгаданий.

Для header існує аналогічний `header_content`. Якщо модель об'єднала кілька
непорожніх header lines під однією specific field label, код зберігає exact
block, але відкликає вузький field та переводить block у `header_content`.

Нерозпізнаний текст не видаляється і не змушується в найближчу схему.

### B6. Безпечна відмова enrichment

Timeout, HTTP error, invalid JSON, schema error, hallucinated quote або model
omission можуть зменшити лише кількість annotations. Імпорт `rawSource`, source
map і повного fallback document усе одно завершується.

### B7. Provenance

Поточні annotations розрізняють:

- `model_span` — роль запропонована моделлю й прив'язана до exact source;
- `deterministic_section_ownership` — модель запропонувала block boundary, а
  код довів section membership через grounded heading regions;
- `deterministic_section_heading` — код відновив пропущений унікальний
  standalone standard heading без зміни source;
- `deterministic_region_gap` — код зберіг пропущений змістовний gap одним
  coarse section-owned block у безпечно доведеному region;
- `deterministic_header_uncertainty` — exact multiline header block збережено,
  але надто вузьку model field label відкликано.

`human_confirmed` і provenance для майбутніх mechanics належатимуть наступним
шарам; активний structural document не вдає, що вони вже реалізовані.

### B8. Редагування не переписує історію

Майбутній editor створює authoring layer або нову версію. Початковий raw import
залишається доступним для аудиту та повторного parsing.

## 5. Потік даних

1. Прочитати `rawSource`.
2. Побудувати й перевірити `sourceMap`.
3. Записати lossless checkpoint до виклику моделі.
4. Надіслати один natural structural request з оригінальним текстом.
5. Перевірити простий JSON envelope та кожного sibling candidate окремо.
6. Розгорнути fixed arrays у незалежні quote candidates.
7. Незалежно знайти model-proposed section headings, довші headings
   прив'язуючи першими.
8. Відновити лише пропущені унікальні standalone standard headings.
9. Відсортувати grounded headings за source position і побудувати regions.
10. Прив'язати header тільки до header region, а rules/features — тільки до
    region заявленої section, незалежно від порядку fixed arrays у JSON.
11. Згорнути exact cross-bucket duplicates до найточнішої structural role,
    але зберегти однакові same-role claims для можливих повторних occurrences.
12. Надати exact feature boundaries перевагу над overlapping broad
    rules/content claims; часткові або неоднозначні конфлікти не вгадувати.
13. Виправити exact unique standalone heading, помилково повернений як rules
    тієї самої секції.
14. Дозволити whitespace-equivalent match лише за exact token sequence.
15. Створити implicit traits-region, коли header і перший standard heading
    grounded, а надрукованого Traits heading немає.
16. Перепризначити supplementary occurrence, що повністю лежить у grounded
    section region, у консервативний `section_content`.
17. У безпечному standalone-bounded region зберегти кожен змістовний model gap
    одним `section_content`, не вигадуючи feature boundaries.
18. Перетворити прийняті occurrences на internal source spans.
19. Відхилити rewrites, inventions, invalid headings і overlaps.
20. Зберегти specific header field при звичайному line wrapping; відкликати
    field label лише коли всередині починається інша header label.
21. Окремо порахувати returned, suppressed duplicate, accepted model,
    deterministic, total document annotations і rejected models.
22. Побудувати annotated/unclassified/separator partition.
23. Перевірити точну реконструкцію `rawSource`.
24. Створити source-backed `document.json` і `normalized.txt`.

## 6. Взаємодія model + deterministic system

Модель вирішує те, що важко узагальнити regex-списками:

- де закінчується header;
- які paragraphs утворюють одну feature;
- де section-wide rules, а де option;
- як читати monolithic або tabular layout;
- що є supplementary material.

Код вирішує те, що можна й треба гарантувати:

- незмінність source;
- точність quotes;
- source order;
- span coordinates;
- overlaps і duplicate ownership;
- structural precedence точних features над broad overlapping claims;
- role reconciliation exact standalone heading без зміни тексту;
- standalone heading recovery без semantic guess;
- section ownership через grounded source regions;
- coarse gap recovery лише в безпечно доведених regions;
- консервативний semantic audit без зміни block boundaries;
- повний partition і reconstruction;
- safe fallback.

Таким чином deterministic layer не намагається перелічити всі можливі способи
написати `Recharge`, conditions або інші правила. На цьому етапі він узагалі не
інтерпретує їх — він гарантує, що повний точний текст feature збережено.

## 7. Реалізовані перевірки

- monolithic statblock;
- multiline ability table з tabs і CRLF;
- continuation paragraphs у межах однієї feature;
- Unicode і 500 generated arbitrary-format strings;
- model failure та invalid JSON;
- rewritten/invented source quote;
- reordered fixed section buckets і reordered quote всередині одного region;
- model-normalized `CRLF` → `LF` усередині довгої feature;
- duplicate exact complete quotes у різних sections;
- invalid heading claim;
- supplementary quote усередині standard section із безпечним переходом у
  `section_content`;
- пропущений model content у standalone-bounded section, який відновлюється
  одним coarse `section_content`;
- collapsed/monolithic omission, який навмисно лишається `unclassified`, коли
  section boundary незалежно не доведено;
- model omission унікального standalone section heading;
- broad section-rules claim, що перекриває кілька точних features;
- exact standalone heading, помилково повернений у `sectionRules`;
- multi-line specific header field, який зберігається цілком як нейтральний
  `header_content`;
- gap, overlap, renamed unit і changed source text;
- повна реконструкція після кожного сценарію.

## 8. Свідомі обмеження

1. Token-exact anchoring не доводить правильність semantic label. Модель може
   правильно процитувати block, але помилково назвати його field або section.
   Код виправляє section ownership лише коли це доводиться grounded headings;
   решту semantic uncertainty не маскує.
2. Не знайдена exact quote лишається unclassified, навіть якщо людина бачить
   лише незначну модельну помилку копіювання.
3. Normalized renderer стискає довільні whitespace runs усередині підтверджених
   blocks до звичайних пробілів. Він не змінює жодного непробільного token;
   exact початковий layout завжди є в raw source і повному partition.
4. Header ability scores, calculated modifiers, saving throws і proficiency
   bonus уже мають окремий grounded `structuredHeader`. Якщо числовий CR
   підтверджено, PB обов'язково обчислюється кодом; явно надрукований PB
   зберігається з warning при конфлікті. Interactive feature mechanics поки не
   витягаються.
5. Multi-line header audit не намагається автоматично розпізнати всі можливі
   labels. Він відкликає непевний specific field, зберігаючи exact source block
   як `header_content`.
6. Coarse gap recovery навмисно не виділяє окремі feature boundaries. Якщо
   модель пропустила кілька features, editor побачить повний exact section
   content, але для подальшої інтерактивності межі ще треба підтвердити моделлю
   або людиною.

Ці обмеження не порушують головну вимогу: текст не губиться й не підміняється.

## 9. Наступні шари

Поточний локальний web UI вже дозволяє вставити source, запустити активний
pipeline і побачити exact blocks разом із model/deterministic labels, integrity
counters, grounded ability table, окремий рядок ряткидків, PB та report. Окремі
checkbox-перемикачі ховають технічні мітки, вмикають підсвічування лише для
потенційно проблемних `section_content`/`unclassified` blocks і відкривають
видимі поля для редагування. Ці правки належать лише presentation-копії й не
змінюють source-backed document JSON.

### B3 — людське редагування structure

- показувати exact source blocks;
- дозволити змінити role/boundaries без зміни raw import;
- зберігати `human_confirmed` provenance.

### B4 — interactive mechanics

- mechanics посилаються на конкретні source occurrences;
- deterministic extractors беруть лише безсумнівні шаблони;
- модель пропонує складніші claims;
- claims проходять grounding і можуть бути відхилені незалежно;
- partial mechanics result є нормальним;
- source-backed feature text лишається повним fallback UI.

## 10. Критерій готовності

Plan B structural import готовий, якщо для всього тестового corpus виконується:

1. Reconstruction точно дорівнює input.
2. Жодна відповідь моделі не додає символ до source-backed text.
3. Жодна відповідь моделі не прибирає source fragment.
4. Import artifact створюється навіть коли LLM повністю падає.
5. UI розрізняє source text, model labels, derived facts і human confirmation.

Поточна збірка реалізує перші чотири вимоги на рівні даних і тестів. П'ята
потребує майбутнього editor/UI.

### Candidate reconciliation (v10)

The active model transport returns only sparse structural spans (`n`, `sta`, `h`, `f`, `r`, `sc`, `sup`, `u`). Standard section headings are deliberately not model output: they are recovered and validated directly from exact source text. Header subtypes are likewise deterministic when the local printed evidence is strong.

Before the legacy exact quote anchor runs, a conservative candidate reconciliation layer may refine a model hypothesis only when independent source evidence supports the change. It can reject impossible section-rules outside a proven section, restore a false model heading as a named feature, merge a standalone feature name with adjacent prose, attach an omitted continuation gap backward when no competing start exists, and split a coarse first section span at a strong internal named-feature start. Ambiguous text remains generic or unclassified rather than being guessed.


### Layout-independent ability table recovery

Structured ability facts are recovered by a separate constraint solver rather than by
recognizing one printed table format. The solver grounds six semantic ability labels in
the header region, extracts numeric atoms from source, validates score→modifier
mathematically, and accepts only one unique six-ability assignment. Optional save values
may be recovered when the local numeric structure is unambiguous; PB is only additional
consistency evidence. Candidate LLM output may supply exact localized label→canonical
ability hints, but never supplies scores, modifiers, saves, coordinates, or inferred
numeric values. The legacy direct ability-table parser remains the first path and the
constraint solver is an independent recovery/confirmation path.


## Додаток: deterministic ability ownership

Constraint-proven ability facts мають впливати не лише на `structuredHeader`. Після
унікального розв'язку весь доведений header-region стає одним `ability_scores`
annotation і shadow-ить дрібні generic model headers усередині. Після rebuild усі
structured facts обчислюються повторно, щоб їх `annotationId` посилався на фінальну
розмітку.

`Regional Effects` є механічною sibling section. Натомість `supplementary` reserved
для descriptive/post-statblock prose поза механічним statblock і в UI подається як
`description · post_statblock_content`.

## v2.16: reconciliation after multi-format testing

The sparse model transport remains unchanged. New deterministic refinement operates
only after grounding evidence exists:

- A coarse `header_field` may be divided at multiple exact printed header labels,
  including several fields on one physical line. This belongs to the semantic header
  layer, not the language-neutral candidate lattice.
- The first body span after a proven section heading is `section_rules` only when it
  begins as prose. A strong named option remains `feature` even if the model called it
  rules.
- A feature title whose parenthetical qualifier is visibly unfinished at a candidate
  boundary can be continued through a short following span until the parentheses close.
  This is punctuation/shape evidence and fails closed across headers/headings.
- `supplementary` inside an ordinary grounded section is still reconciled to
  `section_content`, except for explicit trailing supplementary after the last grounded
  mechanical annotation of the final section. A narrow deterministic fallback can
  begin post-statblock ownership from trailing `Label: value`-shaped metadata after the
  last named feature.
- Diagnostics are deduplicated by complete issue identity, and debug annotation lookup
  no longer assumes candidate indices remain unique after deterministic replacement.
