# План А: дослідницький звіт про автоматичний розбір статблоків

Дата фіксації: 2026-08-17

Статус: експериментальний підхід зафіксовано; він більше не є фундаментом гарантії збереження даних. Його компоненти залишаються придатними як додатковий шар автоматичного структурування та механічного збагачення.

## 1. Початкова мета

План А перевіряв, чи здатна локальна модель `qwen3:8b` майже повністю автоматично перетворити довільно оформлений текст D&D-статблоку на структурований JSON, а потім — на машинні механіки для майбутньої інтерактивності.

Бажаний максимальний результат:

1. Прочитати текст із невідомою або пошкодженою розміткою.
2. Нормалізувати заголовок і секції.
3. Розділити traits, actions, bonus actions, reactions, legendary, mythic та lair actions.
4. Витягнути числові поля заголовка.
5. Витягнути атаки, шкоду, ряткидки, перевірки, лікування, умови, посилання на дії, заклинання та використання.
6. Перевірити модель детермінованим кодом.
7. Отримати готовий інтерактивний статблок без ручного втручання.

## 2. Досліджені вхідні випадки

Основні тестові статблоки:

- Aboleth — сучасний офіційний формат, traits, actions і legendary actions.
- Solar — схожий формат із bonus action, spellcasting, кількома типами шкоди й телепортацією.
- Adult Copper Dragon — recharge, spell lists, replacement actions, складні неформальні ефекти та legendary action references.
- Arasta — старіший формат, mythic trait, mythic actions, healing, Temporary Hit Points, формальні умови, summon і посилання між секціями.

Окремо перевірялися:

- CRLF, LF і пошкоджене форматування;
- Markdown headings та plain headings;
- статблок, злитий в один довгий рядок;
- `Recharge 5–6`, `Recharge on 5 or 6`, словесні числа та rest recharge;
- дублювання section rules як action option;
- невідомі або вигадані supplementary sections;
- неоднозначна ability table із колонками Mod і Save.

## 3. Еволюція архітектури

### 3.1. Один структурний LLM-pass

Перший варіант просив модель одразу повернути `MonsterDraft`:

- усі поля заголовка;
- секції;
- назви, descriptions і `sourceText` features;
- usage і action cost;
- попередні mechanic candidates.

Проблема: велика кількість різнорідних завдань в одному запиті збільшувала кількість помилок і ускладнювала визначення їхнього джерела.

### 3.2. Два проходи

Завдання було розділено:

1. Structural pass — лише структура статблоку, `suggestedMechanics = []`.
2. Mechanics pass — механічний аналіз уже ізольованих features.

Це прибрало взаємний вплив структурної класифікації та детального механічного JSON.

### 3.3. Монолітний mechanics-pass

Спочатку всі features надсилалися одним mechanics-запитом. На Arasta він завершився фатальним `ZodError`: кілька кандидатів мали непідтримуваний discriminator `type`, через що втрачалася вся відповідь.

Висновок: одна неправильна механіка не повинна робити непридатними правильні sibling candidates.

### 3.4. Candidate-level validation

Валідацію перенесено на рівень окремого кандидата:

- валідні candidates зберігаються;
- невалідний candidate відкидається окремо;
- створюється `invalid_mechanic_candidate` warning;
- структурний і детермінований pipeline продовжує роботу.

Це усунуло фатальні падіння через один enum або відсутнє nullable field.

### 3.5. Ізоляція по одній feature

Кожна trait/action отримала окремий запит. Переваги:

- модель не копіює mechanics із сусідньої feature;
- одна невдала відповідь не зупиняє інші;
- можна бачити час і статус кожного виклику;
- спрощується prompt і локальне діагностування.

На Aboleth 11 ізольованих запитів спочатку зайняли близько 35 секунд замість приблизно 28–31 секунди для одного batch-запиту. Зростання часу виявилося прийнятним.

### 3.6. Grounding

LLM mechanics не входять у фінальний результат без перевірки:

- evidence має бути знайдене в `feature.sourceText`;
- числа, DC, bonuses, ranges та dice formulas повинні бути присутні в evidence;
- damage type і condition мають належати підтримуваним контрактам;
- непідтверджені поля або кандидати відкидаються;
- вигадані supplementary sections видаляються.

Grounding успішно відкидав, серед іншого:

- вигадані DC для Legendary Resistance і Magic Resistance;
- healing із речення про Temporary Hit Points;
- неправильний damage average;
- condition, яка лише згадувалася як prerequisite;
- spell name, помилково поданий як action reference.

### 3.7. Детерміноване вилучення

Регулярними й source-owned правилами вилучалися високонадійні факти:

- attack bonus, reach і range;
- числова damage formula та damage type;
- явні saving throw ability + DC;
- явні ability check + DC;
- деякі condition applications;
- Temporary Hit Points;
- usage/recharge;
- ability modifiers.

Детермінований результат використовувався як fallback і як джерело твердих фактів під час merge.

### 3.8. Merge за source occurrence

LLM і deterministic mechanics об’єднувалися не глобально, а за конкретним місцем у джерелі.

Правило довіри:

- explicit deterministic fact переважає суперечливий LLM fact;
- grounded LLM може доповнити semantic fields, яких deterministic extractor не інтерпретує;
- однаковий текст у різних source occurrences не повинен випадково дедуплікуватися.

### 3.9. Structural reconciliation і coverage

Було додано:

- точне відновлення `headerSourceText`;
- видалення section rules, помилково класифікованих як action option;
- перенесення `Legendary Action Uses` у rules field;
- повне source coverage;
- `uncovered_source` для незбереженого meaningful block;
- consistency validator, який не змінює результат, а лише повідомляє про суперечності.

Тест із Solar, повністю злитим в один рядок, спочатку дав один uncovered block на весь статблок. Після structural ownership recovery той самий випадок завершився з `Uncovered source blocks: 0`.

### 3.10. Семантичний usage reconciler

Окремий source-grounded компонент замінив вузький regex для usage.

Перевірено:

- `Recharge 5–6`;
- `Recharge on 5 or 6`;
- `Recharges on a roll of 5 or 6`;
- `Recharge on five or six`;
- `three times per day`;
- `thrice per day`;
- Short Rest, Long Rest та Short or Long Rest;
- contextual lair alternatives;
- негативні й unrelated roll cases.

Цей компонент показав, що окрему формалізовану підзадачу можна довести до широкого й стабільного покриття без переліку всіх повних речень.

### 3.11. Exact source segment IDs

Щоб модель не копіювала evidence приблизно, application code почав ділити feature на точні sentence segments `s0`, `s1`, `s2` тощо.

Модель повертала `evidenceSegmentIds`, а код:

- перевіряв існування ID;
- забороняв дублікати та перестановку;
- перетворював ID назад на exact raw slice;
- лише після цього позначав mechanic як `semanticClaim`.

Це вирішило проблему пунктуації, Unicode quotes і приблизного evidence, але не гарантувало правильної інтерпретації самого сегмента.

### 3.12. Field-level canonicalization

Невалідне optional field більше не обов’язково знищувало весь candidate:

- unsupported damage trigger ставав `other`;
- source-grounded prerequisite переносився в `condition`;
- неправильні optional values видалялися;
- candidate adjustment фіксувався як info issue;
- required semantic core і вигадані hard facts усе ще відкидалися.

### 3.13. Closed action target IDs

Модель отримувала короткий catalogue invocable features:

```text
id
name
section
```

Вона не бачила sibling rules text, але могла повертати `targetFeatureId`.

Це правильно розв’язало:

- Bite і Claws у Multiattack;
- `claw` → `Claws`;
- legendary Claws → base Claws;
- Swipe → Claws;
- mythic Web of Hair → ordinary Web of Hair.

Unknown IDs і self-references відкидалися.

### 3.14. Розширення mechanic ontology

Додано окремі типи:

- `temporary_hit_points`, щоб не змішувати їх із healing;
- `summon`, щоб виклик істот не ставав action reference.

На фінальній Arasta модель правильно створила summon для двох swarms of spiders і Temporary Hit Points для 100 HP.

### 3.15. Захист локального inference

Після розширення prompt старий `num_ctx = 4096` став граничним. Було додано:

- `num_ctx = 8192` для mechanics;
- максимум 1024 predicted tokens на feature;
- timeout 120 секунд на feature;
- негайний progress log;
- продовження deterministic fallback після model failure.

Фінальний Arasta run не завис: 15 запитів завершилися за 50.1 секунди, 14 succeeded і 1 failed.

## 4. Спостережені результати

### 4.1. Репрезентативні прогони

| Випадок | Structural pass | Mechanics pass | Результат |
| --- | ---: | ---: | --- |
| Aboleth, batch mechanics | 68.1 с | 30.7 с | Повний pipeline; candidate-level проблеми ще фатальні до виправлення |
| Aboleth, перша ізоляція | 57.3 с | 35.3 с / 11 calls | 11/11 calls, coverage 0, consistency 0 |
| Solar | 53.4 с | 43.8 с / 11 calls | Структура правильна; 12 warnings через contract/grounding |
| Solar, one-line input до ownership fix | 54.1 с | 40.9 с / 12 calls | Rules стали action, один uncovered block на весь source |
| Solar, one-line після fix | 56.5 с | 38.8 с / 11 calls | Правильні 2 legendary actions, uncovered 0 |
| Adult Copper Dragon | 53.7 с | 42.2 с / 9 calls | Структура правильна; складні semantic candidates нестабільні |
| Arasta до segment-ID protocol | 65.0 с | 45.5 с / 15 calls | 15/15 calls; 11 warnings, 3 info |
| Arasta, фінальний Plan A run | 71.7 с | 50.1 с / 15 calls | 14 succeeded, 1 failed; 6 warnings, 5 info; coverage 0, consistency 0 |

Часи походять із зафіксованих console logs конкретного локального середовища й не є benchmark моделі загалом.

### 4.2. Фінальний Arasta run

Структурний результат:

- Traits: 5
- Actions: 4
- Legendary actions: 3
- Mythic actions: 3
- Unparsed fragments: 0
- Uncovered source blocks: 0
- Consistency warnings: 0

Правильно отримані semantic mechanics:

- Multiattack → Bite + 2 Claws;
- Poisoned і Paralyzed для Bite;
- Swarm як summon;
- Toxic Web damage із prerequisite;
- Swipe → 2 Claws;
- mythic Web of Hair → recharge and use base action;
- Nyx Weave save і force damage;
- 100 Temporary Hit Points.

Відкинуті помилки моделі:

- 200 regained HP помилково класифіковано як Temporary Hit Points;
- Legendary Resistance отримала вигадані Wisdom save DC 14;
- Magic Resistance отримала вигадані Dexterity save DC 14;
- `32 (5d12)` poison damage отримала неправильний average 16;
- вигаданий supplementary section Regional Effects видалено.

Окрема Web of Hair відповідь почала багаторазово дублювати один condition candidate, вперлася в output cap і завершилася обірваним JSON. Ізоляція зберегла решту результату, deterministic extraction відновив Dexterity save і Strength check.

Неповна інтерактивність фінального output:

- не збережено healing 200 HP в Armor of Spiders;
- Web of Hair не отримала Restrained condition через failed LLM call;
- poison damage Bite втратила `half on success`, бо правильна semantic relation містилася в candidate із неправильним average.

## 5. Що підтвердив Plan A

### Позитивні результати

1. `qwen3:8b` здатна досить добре розділяти знайомі офіційні статблоки.
2. Structural pass і mechanics pass варто тримати окремо.
3. Per-feature isolation різко покращує failure containment і діагностику.
4. Exact source grounding ефективно блокує значну частину hallucinations.
5. Deterministic extraction добре відновлює стандартні hard facts.
6. Closed target catalogues кращі за вільне генерування назв.
7. Семантичний reconciler може стабільно працювати для чітко обмеженої підзадачі, як usage.
8. Source coverage та immutable raw source дають практичний захист від непомітної втрати даних.
9. Локальна модель може дати значну частину майбутньої інтерактивної розмітки як best-effort enrichment.

### Негативні результати

1. Модель не перестає вигадувати hard facts навіть після прямих заборон і прикладів.
2. Exact evidence доводить походження тексту, але не правильність його semantic interpretation.
3. Розширення enums і phrase recognizers не збігається до універсального рішення.
4. Новий статблок регулярно відкриває інший клас помилки.
5. Модель може повторювати candidates до обриву JSON.
6. Якщо candidate одночасно містить неправильний fact і правильну semantic relation, candidate-level rejection втрачає корисну семантику.
7. Детермінований extractor не має універсальної граматики природної мови й не може повністю замінити semantic model.
8. Повна automatic interactivity залишається непередбачуваною навіть тоді, коли текстовий статблок структуровано правильно.

## 6. Прогноз для Plan A

### Що реалістично

Plan A може стати якісним прискорювачем для обмеженого корпусу знайомих D&D-форматів:

- більшість standard attacks, damage, saves і checks;
- значна частина action references;
- поширені formal conditions;
- usage/recharge;
- частина spell lists, summons і складних prerequisites.

Точний відсоток автоматичного покриття за наявним малим корпусом оцінювати некоректно. Спостереження показують, що більшість стандартних механічних атомів знаходиться, але warnings і семантичні прогалини не зникають від одного лише вдосконалення prompt.

### Що нереалістично

Не слід очікувати, що `qwen3:8b`, більша модель або нескінченний набір локальних patches гарантуватимуть повністю правильну інтерактивну структуру для будь-якого довільного статблоку без review.

Покращення моделі зменшить error rate, але не перетворить probabilistic interpretation на абсолютну гарантію.

### Найкраще подальше використання

Plan A слід зберегти як optional enrichment pipeline над lossless Plan B:

- він може пропонувати structure labels і mechanics;
- усі claims повинні мати exact provenance;
- hard deterministic facts бажано вилучати до LLM і передавати моделі як атоми для semantic annotation, а не просити повторно переписувати числа;
- невдала або неповна анотація не повинна впливати на збереження статблоку;
- model-grounded, deterministic і human-confirmed data повинні мати різний provenance status.

## 7. Причина переходу до Plan B

Дослідження не показало, що Plan A марний. Воно показало правильну межу його застосування.

Plan A добре відповідає на питання:

> Скільки структури та інтерактивності можна додати автоматично?

Він не може бути єдиною відповіддю на питання:

> Як гарантувати, що імпорт нічого не загубив і не перебрехав?

Для другої вимоги source text має бути первинною істиною, а модель повинна повертати лише перевірювані посилання на exact source regions. Нерозпізнаний випадок має деградувати в точний text-only block, а не в неправильний структурований факт.

## 8. Зафіксовані артефакти

Окремий Plan A snapshot повинен містити:

- вихідний код на момент завершення експерименту;
- цей звіт;
- `ARCHITECTURE_AUDIT.md`;
- фінальний `arasta.mechanics.raw.json`;
- фінальний `arasta.output.json`;
- фінальний `arasta.report.json`;
- попередній успішний Arasta raw/report до exact segment-ID protocol для порівняння.

Основний робочий проєкт після цієї точки переходить до Plan B. Plan A snapshot більше не слід переписувати наступними архітектурними змінами.
