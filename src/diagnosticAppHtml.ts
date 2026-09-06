export const APP_HTML = String.raw`<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lossless Statblock Parser</title>
  <style> :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #111315;
      color: #ece7da;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: linear-gradient(145deg, #111315, #171313 55%, #101417); }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 70px; }
    h1 { margin: 0; font-family: Georgia, serif; font-size: clamp(30px, 5vw, 46px); color: #f2e2b8; }.lead { color: #aca79b; margin: 8px 0 26px; max-width: 760px; line-height: 1.55; }.panel { background: rgba(29, 31, 32,.94); border: 1px solid #3b3d3c; border-radius: 14px; padding: 20px; box-shadow: 0 16px 45px rgba(0,0,0,.25); }
    label { display: block; margin-bottom: 9px; color: #ddd3bd; font-weight: 700; }
    textarea { width: 100%; min-height: 350px; resize: vertical; border: 1px solid #55554f; border-radius: 10px; padding: 15px; background: #0e1011; color: #f4f1e9; font: 15px/1.5 Consolas, "Courier New", monospace; }
    textarea:focus { outline: 2px solid #b58b46; border-color: transparent; }.actions { display: flex; gap: 12px; align-items: center; margin-top: 14px; flex-wrap: wrap; }
    button { border: 0; border-radius: 9px; padding: 11px 17px; cursor: pointer; font-weight: 750; background: #b58b46; color: #15110a; }
    button.secondary { background: #353737; color: #ece7da; border: 1px solid #555; }
    button:disabled { opacity:.55; cursor: wait; } select { border: 1px solid #55554f; border-radius: 7px; padding: 7px 9px; background: #17191a; color: #ece7da; }
    #status { color: #bdb8aa; }
    #error { display: none; margin-top: 14px; padding: 12px 14px; border-radius: 9px; background: #4a1e1e; color: #ffd6d2; white-space: pre-wrap; }
    #result { display: none; margin-top: 24px; }.summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }.badge { border: 1px solid #53534d; border-radius: 999px; padding: 6px 10px; color: #d6d0c3; background: #242627; font-size: 13px; }.badge.good { border-color: #486b55; color: #bfe7c9; }.badge.warn { border-color: #806636; color: #f1d898; }.statblock { background: #f2ead5; color: #241d17; border: 1px solid #c7a761; border-top: 7px solid #8b2b20; border-bottom: 7px solid #8b2b20; padding: 24px; box-shadow: 0 18px 50px rgba(0,0,0,.28); }.source-block { position: relative; white-space: pre-wrap; overflow-wrap: anywhere; padding: 5px 8px; margin: 0 -8px; border-radius: 5px; line-height: 1.45; }.source-block +.source-block { margin-top: 5px; }.source-block.feature,.source-block.section_rules,.source-block.section_content,.source-block.supplementary { margin-top: 14px; }.source-block.section_heading { margin-top: 22px; padding-top: 8px; border-bottom: 2px solid #8b2b20; border-radius: 0; color: #78251c; font: 700 23px/1.25 Georgia, serif; }.source-block.header_field:first-child { color: #78251c; font: 700 31px/1.2 Georgia, serif; }.source-block.section_rules { font-style: italic; }.technical-label { display: inline-block; margin: 0 8px 3px 0; padding: 2px 6px; border-radius: 4px; background: rgba(36, 29, 23,.11); color: #6c6258; font: 600 10px/1.4 ui-monospace, monospace; text-transform: uppercase; letter-spacing:.04em; vertical-align: 1px; }.ability-grid { width: 100%; margin-top: 6px; border-collapse: collapse; table-layout: fixed; text-align: center; }.ability-grid th { color: #78251c; font: 700 13px/1.2 ui-monospace, monospace; }.ability-grid td { padding: 5px 2px; font-weight: 700; }.saving-throws-row,.proficiency-row { display: inline-block; font-weight: 700; }
    body.hide-labels .technical-label { display: none; }body.show-problem-highlights .source-block.section_content,body.show-problem-highlights .source-block.unclassified { background: #fff0bc; outline: 1px dashed #a27b22; }.result-actions { display: flex; gap: 10px; flex-wrap: wrap; margin: 0 0 14px; align-items: center; }.toggle { display: inline-flex; gap: 6px; align-items: center; margin: 0; color: #c7c1b5; font-size: 14px; }.toggle:first-of-type { margin-left: auto; }.toggle input { margin: 0; }.statblock.editing .editable-content { outline: 1px dashed #9a702f; outline-offset: 3px; background: rgba(255,255,255,.42); cursor: text; }.edit-note { width: 100%; margin: 0; color: #a9a397; font-size: 12px; text-align: right; }
    details { margin-top: 16px; border: 1px solid #414343; border-radius: 10px; background: #1c1e1f; }
    summary { padding: 12px 14px; cursor: pointer; font-weight: 700; color: #ddd3bd; }
    details pre { margin: 0; padding: 0 14px 14px; overflow: auto; white-space: pre-wrap; color: #d6d1c7; font: 13px/1.45 Consolas, monospace; }
    .timing-report { padding: 0 14px 14px; }.timing-row { display: grid; grid-template-columns: minmax(190px, 1fr) auto; gap: 18px; padding: 6px 0; border-bottom: 1px solid #303233; }.timing-row:last-child { border-bottom: 0; }.timing-name { color: #bdb8aa; }.timing-value { color: #ece7da; font: 600 13px/1.4 Consolas, monospace; text-align: right; }.timing-group { margin: 10px 0 3px; color: #d6c49a; font-weight: 700; }
    @media (max-width: 650px) {
      main { width: min(100% - 18px, 1180px); padding-top: 20px; }.panel { padding: 13px; }
      textarea { min-height: 290px; }.statblock { padding: 17px 14px; }.toggle { width: 100%; margin-left: 0; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Lossless Statblock Parser</h1>
    <p class="lead">Вставте статблок у будь-якому текстовому оформленні. Результат збереже весь вихідний текст і покаже структурні мітки, які пройшли source-перевірку.</p>

    <section class="panel">
      <form id="parser-form">
        <label for="source">Текст статблоку</label>
        <textarea id="source" name="source" spellcheck="false" placeholder="Вставте сюди статблок..."></textarea>
        <div class="actions">
          <label style="margin:0">Режим <select id="parser-mode"><option value="auto">Автоматично</option><option value="multiline">Багаторядковий</option><option value="singleline">Однорядковий / злиплий</option><option value="generic">Універсальний LLM</option></select></label>
          <button id="submit" type="submit">Розібрати статблок</button>
          <span id="status"></span>
        </div>
        <div id="error" role="alert"></div>
      </form>
    </section>

    <section id="result">
      <div id="summary" class="summary"></div>
      <div class="result-actions">
        <button id="copy-normalized" class="secondary" type="button">Копіювати нормалізований текст</button>
        <button id="copy-json" class="secondary" type="button">Копіювати document JSON</button>
        <label class="toggle"><input id="show-labels" type="checkbox" checked> Показувати технічні мітки</label>
        <label class="toggle"><input id="show-problems" type="checkbox"> Підсвічувати потенційно проблемні ділянки</label>
        <label class="toggle"><input id="edit-result" type="checkbox"> Редагувати поля результату</label>
        <p class="edit-note">Ручні правки змінюють лише видиму копію; перевірений document JSON залишається незмінним.</p>
      </div>
      <div id="statblock" class="statblock"></div>
      <details>
        <summary>Час виконання</summary>
        <div id="timing-report" class="timing-report"></div>
      </details>
      <details>
        <summary>Нормалізований текст</summary>
        <pre id="normalized"></pre>
      </details>
      <details>
        <summary>Звіт парсера</summary>
        <pre id="report"></pre>
      </details>
      <details>
        <summary>Sparse candidate spans (тест)</summary>
        <pre id="candidate-report"></pre>
      </details>
      <details>
        <summary>Сира відповідь моделі</summary>
        <pre id="raw-model"></pre>
      </details>
    </section>
  </main>

  <script>
    const form = document.getElementById("parser-form");
    const sourceInput = document.getElementById("source");
    const submitButton = document.getElementById("submit");
    const parserModeInput = document.getElementById("parser-mode");
    const statusNode = document.getElementById("status");
    const errorNode = document.getElementById("error");
    const resultNode = document.getElementById("result");
    const summaryNode = document.getElementById("summary");
    const statblockNode = document.getElementById("statblock");
    const normalizedNode = document.getElementById("normalized");
    const reportNode = document.getElementById("report");
    const candidateReportNode = document.getElementById("candidate-report");
    const rawModelNode = document.getElementById("raw-model");
    const timingReportNode = document.getElementById("timing-report");
    const editResultToggle = document.getElementById("edit-result");
    let lastResult = null;

    function addBadge(text, kind) {
      const badge = document.createElement("span");
      badge.className = "badge " + (kind || "");
      badge.textContent = text;
      summaryNode.appendChild(badge);
    }

    function annotationLabel(annotation, block) {
      if (!annotation) return block.kind;
      if (annotation.role === "supplementary") return "description · post_statblock_content";
      const detail = annotation.field || annotation.section;
      return detail ? detail + " · " + annotation.role : annotation.role;
    }

    function normalizeText(text) {
      return text.replace(/\s+/gu, " ").trim();
    }

    function renderAbilityTable(documentData, element) {
      const keys = ["str", "dex", "con", "int", "wis", "cha"];
      const abilities = documentData.structuredHeader && documentData.structuredHeader.abilities;
      if (!abilities || keys.some(function (key) { return !abilities[key]; })) return false;

      const table = document.createElement("table");
      table.className = "ability-grid";
      const head = document.createElement("tr");
      const values = document.createElement("tr");

      keys.forEach(function (key) {
        const heading = document.createElement("th");
        heading.textContent = key.toUpperCase();
        head.appendChild(heading);

        const cell = document.createElement("td");
        const fact = abilities[key];
        const sign = fact.modifier >= 0 ? "+" : "";
        cell.className = "editable-content";
        cell.appendChild(document.createTextNode(fact.score + " (" + sign + fact.modifier + ")"));
        values.appendChild(cell);
      });

      table.appendChild(head);
      table.appendChild(values);
      element.appendChild(table);
      return true;
    }

    function renderSavingThrowsRow(documentData, element) {
      const names = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
      const saves = documentData.structuredHeader && documentData.structuredHeader.savingThrows;
      if (!saves || saves.length === 0) return false;
      const content = document.createElement("span");
      content.className = "editable-content saving-throws-row";
      content.textContent = "Ряткидки " + saves.map(function (save) { return names[save.ability] + " " + (save.bonus >= 0 ? "+" : "") + save.bonus; }).join(", ");
      element.appendChild(content);
      return true;
    }

    function addDerivedBlock(labelText, roleClass, contentText) {
      const element = document.createElement("div");
      element.className = "source-block " + roleClass;
      const label = document.createElement("span");
      label.className = "technical-label";
      label.textContent = labelText;
      const content = document.createElement("span");
      content.className = "editable-content " + roleClass + "-row";
      content.textContent = contentText;
      element.append(label, content);
      statblockNode.appendChild(element);
    }

    function renderDocument(documentData) {
      statblockNode.replaceChildren();
      const annotations = new Map(documentData.annotations.map(function (annotation) {
        return [annotation.id, annotation];
      }));
      const hasSavingThrowsField = documentData.annotations.some(function (annotation) { return annotation.role === "header_field" && annotation.field === "saving_throws"; });
      const proficiencyBonus = documentData.structuredHeader && documentData.structuredHeader.proficiencyBonus;
      const proficiencySourceAnnotationId = proficiencyBonus && !proficiencyBonus.printed && proficiencyBonus.source ? proficiencyBonus.source.annotationId : null;
      let proficiencySourceLastBlockIndex = -1;
      if (proficiencySourceAnnotationId) {
        documentData.blocks.forEach(function (currentBlock, currentIndex) {
          if (currentBlock.kind !== "separator" && currentBlock.annotationId === proficiencySourceAnnotationId) proficiencySourceLastBlockIndex = currentIndex;
        });
      }

      let postStatblockHeadingRendered = false;
      documentData.blocks.forEach(function (block, blockIndex) {
        if (block.kind === "separator") return;
        const annotation = block.annotationId ? annotations.get(block.annotationId) : null;
        if (annotation && annotation.role === "supplementary" && !postStatblockHeadingRendered) {
          const heading = document.createElement("div");
          heading.className = "source-block section_heading post-statblock-heading";
          const headingLabel = document.createElement("span");
          headingLabel.className = "technical-label";
          headingLabel.textContent = "description · section_heading";
          const headingContent = document.createElement("span");
          headingContent.className = "editable-content";
          headingContent.textContent = "Опис";
          heading.append(headingLabel, headingContent);
          statblockNode.appendChild(heading);
          postStatblockHeadingRendered = true;
        }
        const element = document.createElement(annotation && annotation.role === "section_heading" ? "div" : "div");
        element.className = "source-block " + (annotation ? annotation.role : block.kind);
        const label = document.createElement("span");
        label.className = "technical-label";
        label.textContent = annotationLabel(annotation, block);
        element.appendChild(label);
        const renderedAsAbilityTable = annotation && annotation.field === "ability_scores" && renderAbilityTable(documentData, element);
        const renderedAsSavingThrows = annotation && annotation.field === "saving_throws" && renderSavingThrowsRow(documentData, element);
        if (!renderedAsAbilityTable && !renderedAsSavingThrows) {
          const content = document.createElement("span");
          content.className = "editable-content";
          content.textContent = normalizeText(block.text);
          element.appendChild(content);
        }
        statblockNode.appendChild(element);
        if (renderedAsAbilityTable && !hasSavingThrowsField && documentData.structuredHeader.savingThrows.length > 0) {
          addDerivedBlock("structured · saving_throws", "saving-throws", "Ряткидки " + documentData.structuredHeader.savingThrows.map(function (save) { return save.ability.toUpperCase() + " " + (save.bonus >= 0 ? "+" : "") + save.bonus; }).join(", "));
        }
        if (proficiencyBonus && !proficiencyBonus.printed && blockIndex === proficiencySourceLastBlockIndex) {
          addDerivedBlock("derived from CR · proficiency_bonus", "proficiency", "Бонус майстерності " + (proficiencyBonus.value >= 0 ? "+" : "") + proficiencyBonus.value);
        }
      });
      setEditMode(editResultToggle.checked);
    }

    function setEditMode(enabled) {
      statblockNode.classList.toggle("editing", enabled);
      statblockNode.querySelectorAll(".editable-content").forEach(function (element) {
        element.contentEditable = enabled ? "true" : "false";
        element.spellcheck = enabled;
      });
    }

    function collectEditedNormalizedText() {
      return Array.from(statblockNode.querySelectorAll(".source-block:not(.post-statblock-heading)")).map(function (block) {
        const table = block.querySelector(".ability-grid");
        if (table) {
          const headings = Array.from(table.querySelectorAll("th")).map(function (cell) { return cell.textContent.trim(); });
          return Array.from(table.querySelectorAll("td")).map(function (cell, index) { return headings[index] + " " + cell.innerText.trim(); }).join("\t");
        }
        const content = block.querySelector(".editable-content");
        return content ? content.innerText.trim() : "";
      }).filter(Boolean).join("\n\n");
    }

    function formatSeconds(value) {
      return typeof value === "number" ? value.toFixed(value >= 10 ? 2 : 3) + " с" : "—";
    }

    function addTimingRow(name, value) {
      const row = document.createElement("div");
      row.className = "timing-row";
      const label = document.createElement("span");
      label.className = "timing-name";
      label.textContent = name;
      const result = document.createElement("span");
      result.className = "timing-value";
      result.textContent = value;
      row.append(label, result);
      timingReportNode.appendChild(row);
    }

    function addTimingGroup(name) {
      const group = document.createElement("div");
      group.className = "timing-group";
      group.textContent = name;
      timingReportNode.appendChild(group);
    }

    function renderTimingReport(data) {
      timingReportNode.replaceChildren();
      const timing = data.timing;
      if (!timing) {
        addTimingRow("Метрики", "недоступні");
        return;
      }

      addTimingGroup("Загалом");
      addTimingRow("Від натискання до відповіді браузеру", formatSeconds(data.browserRoundTripSeconds));
      addTimingRow("Обробка на сервері", formatSeconds(timing.totalServerSeconds));
      addTimingRow("Створення source map", formatSeconds(timing.sourceMapSeconds));
      addTimingRow("Pipeline після source map", formatSeconds(timing.analyze.totalSeconds));

      addTimingGroup("Pipeline");
      addTimingRow("Виклик моделі", formatSeconds(timing.analyze.modelCallSeconds));
      addTimingRow("Розбір відповіді моделі", formatSeconds(timing.analyze.responseParsingSeconds));
      addTimingRow("Прив’язка джерела", formatSeconds(timing.analyze.quoteAnchoringSeconds));
      addTimingRow("Компіляція документа", formatSeconds(timing.analyze.documentCompilationSeconds));
      addTimingRow("Структурований header", formatSeconds(timing.analyze.headerEnrichmentSeconds));

      const ollama = timing.analyze.ollama;
      if (ollama) {
        addTimingGroup("Ollama");
        addTimingRow("Внутрішній total", formatSeconds(ollama.totalSeconds));
        addTimingRow("Завантаження моделі", formatSeconds(ollama.loadSeconds));
        addTimingRow("Prompt eval", formatSeconds(ollama.promptEvalSeconds));
        addTimingRow("Prompt tokens", ollama.promptEvalCount === null ? "—" : String(ollama.promptEvalCount));
        addTimingRow("Generation", formatSeconds(ollama.evalSeconds));
        addTimingRow("Output tokens", ollama.evalCount === null ? "—" : String(ollama.evalCount));
        if (ollama.promptEvalSeconds && ollama.promptEvalCount) {
          addTimingRow("Prompt throughput", (ollama.promptEvalCount / ollama.promptEvalSeconds).toFixed(1) + " ток/с");
        }
        if (ollama.evalSeconds && ollama.evalCount) {
          const generationThroughput = ollama.evalCount / ollama.evalSeconds;
          addTimingRow("Generation throughput", generationThroughput.toFixed(1) + " ток/с");
          addTimingRow("100 output tokens", formatSeconds(100 / generationThroughput));

          if (typeof ollama.totalSeconds === "number" && ollama.totalSeconds > 0) {
            addTimingRow("Частка generation", (ollama.evalSeconds / ollama.totalSeconds * 100).toFixed(1) + "%");
          }

          const fixedSeconds = Math.max(0, timing.totalServerSeconds - ollama.evalSeconds);
          [800, 600, 400].forEach(function (targetTokens) {
            const projectedSeconds = fixedSeconds + targetTokens / generationThroughput;
            addTimingRow("Прогноз при " + targetTokens + " output tokens", formatSeconds(projectedSeconds));
          });
        }
      }
    }

    function formatCandidateDebug(debug) {
      if (!debug) return "Candidate diagnostics недоступні.";

      const lines = [
        "Статус: " + debug.status,
        "Candidates: " + debug.candidateCount,
        "Логічних блоків: " + debug.runCount,
        "Покрито candidates: " + debug.coveredCandidateCount,
        "Explicit unclassified spans: " + debug.unclassifiedRunCount,
      ];

      if (debug.modelError) {
        lines.push("Помилка моделі: " + debug.modelError);
      }

      lines.push("");
      for (let index = 0; index < debug.runs.length; index += 1) {
        const run = debug.runs[index];
        const range = run.startId === run.endId ? run.startId : run.startId + "–" + run.endId;
        const accepted = run.accepted ? "✓" : run.classification === "unclassified" ? " " : "×";
        const target = run.acceptedField ?? run.acceptedSection ?? run.acceptedRole ?? "";
        const preview = run.startPreview.replace(/\s+/g, " ").slice(0, 120);
        lines.push(
          ("R" + String(index).padStart(2, "0") + "  " + range).padEnd(17, " ") +
          " len=" + String(run.runLength).padEnd(3, " ") +
          " [" + run.classification + "] " + accepted + (target ? " " + target : "") + " :: " + preview
        );
      }

      return lines.join("\n");
    }

    function renderResult(data) {
      lastResult = data;
      summaryNode.replaceChildren();
      const model = data.report.model;
      const integrity = data.report.integrity;
      addBadge(integrity.reconstructsRawSource ? "Exact source: так" : "Exact source: ні", integrity.reconstructsRawSource ? "good" : "warn");
      addBadge("Модель: " + (model.succeeded ? "успішно" : "safe fallback"), model.succeeded ? "good" : "warn");
      addBadge("Transport: sparse candidate spans", "");
      if (data.parserRouting) addBadge("Parser: " + data.parserRouting.selectedMode + (data.parserRouting.requestedMode === "auto" ? " (auto: " + (data.parserRouting.detectedStructure || "unknown") + ")" : " (manual)"), "");
      if (data.candidateDebug) addBadge("Candidates: " + data.candidateDebug.candidateCount, "");
      if (data.timing) addBadge("Час: " + formatSeconds(data.timing.totalServerSeconds), "");
      addBadge("Прийнято: " + model.acceptedModelAnnotationCount, "");
      addBadge("Детерміновано: " + model.deterministicAnnotationCount, "");
      addBadge("Згорнуто дублів: " + model.suppressedDuplicateCandidateCount, "");
      addBadge("Відхилено: " + model.rejectedCandidateCount, model.rejectedCandidateCount ? "warn" : "good");
      addBadge("Unclassified: " + data.report.unclassifiedBlockCount, data.report.unclassifiedBlockCount ? "warn" : "good");
      addBadge("Issues: " + data.report.issues.length, data.report.issues.some(function (issue) { return issue.severity === "warning"; }) ? "warn" : "");
      const abilityCount = Object.values(data.document.structuredHeader.abilities).filter(Boolean).length;
      addBadge("Характеристики: " + abilityCount + "/6", abilityCount === 6 ? "good" : "warn");
      addBadge("Ряткидки: " + data.document.structuredHeader.savingThrows.length, "");
      const proficiencyBonus = data.document.structuredHeader.proficiencyBonus;
      addBadge("PB: " + (proficiencyBonus ? (proficiencyBonus.value >= 0 ? "+" : "") + proficiencyBonus.value : "—"), proficiencyBonus ? "good" : "");
      renderDocument(data.document);
      normalizedNode.textContent = data.normalized;
      reportNode.textContent = JSON.stringify(data.report, null, 2);
      candidateReportNode.textContent = formatCandidateDebug(data.candidateDebug);
      rawModelNode.textContent = data.rawModelContent || "Сира відповідь моделі недоступна.";
      renderTimingReport(data);
      resultNode.style.display = "block";
      resultNode.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function copyText(text, button) {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = "Скопійовано";
      setTimeout(function () { button.textContent = original; }, 1300);
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const source = sourceInput.value;
      if (!source.trim()) {
        errorNode.textContent = "Вставте текст статблоку.";
        errorNode.style.display = "block";
        return;
      }

      errorNode.style.display = "none";
      resultNode.style.display = "none";
      submitButton.disabled = true;
      statusNode.textContent = "Модель читає статблок. Це може тривати кілька хвилин…";

      try {
        const requestStartedAt = performance.now();
        const response = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
          body: JSON.stringify({ source: source, parserMode: parserModeInput.value })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Помилка запиту.");
        data.browserRoundTripSeconds = (performance.now() - requestStartedAt) / 1000;
        renderResult(data);
        statusNode.textContent = "Готово.";
      } catch (error) {
        errorNode.textContent = error instanceof Error ? error.message : String(error);
        errorNode.style.display = "block";
        statusNode.textContent = "";
      } finally {
        submitButton.disabled = false;
      }
    });

    document.getElementById("show-labels").addEventListener("change", function (event) {
      document.body.classList.toggle("hide-labels", !event.target.checked);
    });
    document.getElementById("show-problems").addEventListener("change", function (event) {
      document.body.classList.toggle("show-problem-highlights", event.target.checked);
    });
    editResultToggle.addEventListener("change", function (event) { setEditMode(event.target.checked); });
    document.getElementById("copy-normalized").addEventListener("click", function (event) {
      if (lastResult) copyText(editResultToggle.checked ? collectEditedNormalizedText() : lastResult.normalized, event.currentTarget);
    });
    document.getElementById("copy-json").addEventListener("click", function (event) {
      if (lastResult) copyText(JSON.stringify(lastResult.document, null, 2), event.currentTarget);
    });
  </script>
</body>
</html>`;
