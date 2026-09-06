import {
  d20WithModifier,
  findD20Modifiers,
  findDiceExpressions,
  findLimitedUseExpressions,
  findRechargeExpressions,
  type DiceExpression,
  type DiceRollResult,
  type EditableHeaderRow,
  type EditableStatblockNode,
} from "statblock-parser-core/product";
import { formatBonus } from "../statblockUi";
import { splitKnownHeaderRow } from "./statblockPresentation";

export type InlineRollMap = Record<string, DiceRollResult>;
export type LimitedUseValues = Readonly<Record<string, number>>;

function ukrainianDiceNotation(expression: DiceExpression): string {
  const base = `${expression.count}к${expression.sides}`;
  if (expression.modifier === 0) return base;
  return `${base}${expression.modifier > 0 ? "+" : ""}${expression.modifier}`;
}

export function InlineRollResult({ result }: { result: DiceRollResult | undefined }) {
  if (result === undefined) return null;
  return <strong className="inline-roll-result"> = {result.total}</strong>;
}

function InteractivePlainText({
  text,
  keyPrefix,
  label,
  onRoll,
  results,
  allowModifiers = true,
  limitedUses,
  onLimitedUseChange,
}: {
  text: string;
  keyPrefix: string;
  label: string;
  onRoll: (key: string, expression: DiceExpression, label: string) => void;
  results: InlineRollMap;
  allowModifiers?: boolean;
  limitedUses?: LimitedUseValues;
  onLimitedUseChange?: (key: string, maximum: number, value: number) => void;
}) {
  const dice = findDiceExpressions(text).map((match) => {
    const prefix = text.slice(0, match.start);
    const averagePrefix = /(?<![\p{L}\p{N}_])(\d+)[ \t]*\([ \t]*$/u.exec(prefix);
    const closing = /^[ \t]*\)/u.exec(text.slice(match.end));
    if (averagePrefix !== null && averagePrefix.index !== undefined && closing !== null) {
      const start = averagePrefix.index;
      const end = match.end + closing[0].length;
      return {
        kind: "dice_average" as const,
        start,
        end,
        source: text.slice(start, end),
        diceSource: match.source,
        diceStartWithinSource: match.start - start,
        diceEndWithinSource: match.end - start,
        expression: match.expression,
      };
    }
    return {
      kind: "dice" as const,
      start: match.start,
      end: match.end,
      source: match.source,
      expression: match.expression,
    };
  });
  const modifiers = allowModifiers
    ? findD20Modifiers(text).map((match) => ({
        kind: "modifier" as const,
        start: match.start,
        end: match.end,
        source: match.source,
        expression: d20WithModifier(match.modifier),
      }))
    : [];
  const recharge = findRechargeExpressions(text).map((match) => ({
    kind: "recharge" as const,
    start: match.start,
    end: match.end,
    source: match.source,
    expression: match.expression,
  }));
  const limited =
    onLimitedUseChange === undefined
      ? []
      : findLimitedUseExpressions(text).map((match) => ({
          kind: "limited" as const,
          start: match.start,
          end: match.end,
          source: match.source,
          maximum: match.maximum,
        }));

  const nowrapMechanics = Array.from(text.matchAll(/\b(?:DC|СК)[ \t]+\d+\b/giu)).map((match) => ({
    kind: "nowrap" as const,
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    source: match[0],
  }));

  const occupied = [...dice, ...recharge, ...limited].map((token) => [token.start, token.end] as const);
  const safeModifiers = modifiers.filter(
    (token) => !occupied.some(([start, end]) => token.start < end && token.end > start),
  );
  const rollOccupied = [...occupied, ...safeModifiers.map((token) => [token.start, token.end] as const)];
  const safeNowrapMechanics = nowrapMechanics.filter(
    (token) => !rollOccupied.some(([start, end]) => token.start < end && token.end > start),
  );
  const tokens = [...dice, ...recharge, ...limited, ...safeModifiers, ...safeNowrapMechanics].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  if (tokens.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  tokens.forEach((token, index) => {
    if (token.start > cursor) parts.push(text.slice(cursor, token.start));
    const key = `${keyPrefix}:${token.kind}:${token.start}:${index}`;
    if (token.kind === "nowrap") {
      parts.push(
        <span key={key} className="mechanic-nowrap">
          {token.source.replace(/[ \t]+/gu, "\u00a0")}
        </span>,
      );
      cursor = token.end;
      return;
    }
    if (token.kind === "limited") {
      const current = Math.min(token.maximum, Math.max(0, limitedUses?.[key] ?? token.maximum));
      parts.push(
        <span key={key} className="limited-use-control mechanic-nowrap">
          <span>
            {token.source.slice(0, -1)} = <strong>{current}</strong>)
          </span>
          <button
            type="button"
            className="limited-use-button"
            disabled={current <= 0}
            aria-label={`Зменшити ${token.source}`}
            onClick={(event) => {
              event.stopPropagation();
              onLimitedUseChange?.(key, token.maximum, current - 1);
            }}
          >
            −
          </button>
          <button
            type="button"
            className="limited-use-button"
            disabled={current >= token.maximum}
            aria-label={`Збільшити ${token.source}`}
            onClick={(event) => {
              event.stopPropagation();
              onLimitedUseChange?.(key, token.maximum, current + 1);
            }}
          >
            +
          </button>
        </span>,
      );
      cursor = token.end;
      return;
    }
    if (token.kind === "dice_average") {
      parts.push(
        <span key={key} className="mechanic-nowrap inline-roll-token-wrap">
          {token.source.slice(0, token.diceStartWithinSource)}
          <button
            type="button"
            className="inline-dice-button"
            title={`Кинути ${ukrainianDiceNotation(token.expression)}`}
            onClick={() => onRoll(key, token.expression, `${label} · ${token.diceSource.trim()}`)}
          >
            {token.diceSource}
          </button>
          {token.source.slice(token.diceEndWithinSource)}
          <InlineRollResult result={results[key]} />
        </span>,
      );
      cursor = token.end;
      return;
    }
    parts.push(
      <span key={key} className="inline-roll-token-wrap">
        <button
          type="button"
          className={
            token.kind === "dice"
              ? "inline-dice-button"
              : token.kind === "recharge"
                ? "inline-recharge-button"
                : "inline-modifier-button"
          }
          title={
            token.kind === "dice"
              ? `Кинути ${ukrainianDiceNotation(token.expression)}`
              : token.kind === "recharge"
                ? "Кинути 1к6 для перезарядки"
                : `Кинути 1к20${formatBonus(token.expression.modifier)}`
          }
          onClick={() => onRoll(key, token.expression, `${label} · ${token.source.trim()}`)}
        >
          {token.source}
        </button>
        <InlineRollResult result={results[key]} />
      </span>,
    );
    cursor = token.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function RichInteractiveText({
  text,
  keyPrefix,
  label,
  onRoll,
  results,
  allowModifiers = true,
  limitedUses,
  onLimitedUseChange,
}: {
  text: string;
  keyPrefix: string;
  label: string;
  onRoll: (key: string, expression: DiceExpression, label: string) => void;
  results: InlineRollMap;
  allowModifiers?: boolean;
  limitedUses?: LimitedUseValues;
  onLimitedUseChange?: (key: string, maximum: number, value: number) => void;
}) {
  // Lightweight authoring markup only: **bold** and *italic*.
  const pattern = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/gu;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let partIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      const plain = text.slice(cursor, start);
      nodes.push(
        <InteractivePlainText
          key={`plain-${partIndex}`}
          text={plain}
          keyPrefix={`${keyPrefix}:plain:${partIndex}`}
          label={label}
          onRoll={onRoll}
          results={results}
          allowModifiers={allowModifiers}
          limitedUses={limitedUses}
          onLimitedUseChange={onLimitedUseChange}
        />,
      );
      partIndex += 1;
    }

    const source = match[0];
    const boldItalic = source.startsWith("***");
    const bold = !boldItalic && source.startsWith("**");
    const inner = boldItalic ? source.slice(3, -3) : bold ? source.slice(2, -2) : source.slice(1, -1);
    const content = (
      <InteractivePlainText
        text={inner}
        keyPrefix={`${keyPrefix}:mark:${partIndex}`}
        label={label}
        onRoll={onRoll}
        results={results}
        allowModifiers={allowModifiers}
        limitedUses={limitedUses}
        onLimitedUseChange={onLimitedUseChange}
      />
    );
    nodes.push(
      boldItalic ? (
        <strong key={`mark-${partIndex}`}>
          <em>{content}</em>
        </strong>
      ) : bold ? (
        <strong key={`mark-${partIndex}`}>{content}</strong>
      ) : (
        <em key={`mark-${partIndex}`}>{content}</em>
      ),
    );
    partIndex += 1;
    cursor = start + source.length;
  }

  if (cursor < text.length) {
    nodes.push(
      <InteractivePlainText
        key={`plain-${partIndex}`}
        text={text.slice(cursor)}
        keyPrefix={`${keyPrefix}:plain:${partIndex}`}
        label={label}
        onRoll={onRoll}
        results={results}
        allowModifiers={allowModifiers}
        limitedUses={limitedUses}
        onLimitedUseChange={onLimitedUseChange}
      />,
    );
  }

  return <>{nodes}</>;
}

export function HeaderRowContent({
  row,
  name,
  onRoll,
  results,
  limitedUses,
  onLimitedUseChange,
}: {
  row: EditableHeaderRow;
  name: string;
  onRoll: (key: string, expression: DiceExpression, label: string) => void;
  results: InlineRollMap;
  limitedUses?: LimitedUseValues;
  onLimitedUseChange?: (key: string, maximum: number, value: number) => void;
}) {
  const split = splitKnownHeaderRow(row);
  if (split.label === null) {
    return (
      <RichInteractiveText
        text={row.text}
        keyPrefix={`header:${row.id}`}
        label={name}
        onRoll={onRoll}
        results={results}
        allowModifiers={row.field !== "proficiency_bonus"}
        limitedUses={limitedUses}
        onLimitedUseChange={onLimitedUseChange}
      />
    );
  }

  return (
    <>
      <strong className="statblock-field-label">{split.label}</strong>
      {split.value.length > 0 && " "}
      <RichInteractiveText
        text={split.value}
        keyPrefix={`header:${row.id}:value`}
        label={name}
        onRoll={onRoll}
        results={results}
        allowModifiers={row.field !== "proficiency_bonus"}
        limitedUses={limitedUses}
        onLimitedUseChange={onLimitedUseChange}
      />
    </>
  );
}

export function BodyParagraphView({
  node,
  name,
  onRoll,
  results,
  limitedUses,
  onLimitedUseChange,
}: {
  node: Extract<EditableStatblockNode, { type: "paragraph" }>;
  name: string;
  onRoll: (key: string, expression: DiceExpression, label: string) => void;
  results: InlineRollMap;
  limitedUses?: LimitedUseValues;
  onLimitedUseChange?: (key: string, maximum: number, value: number) => void;
}) {
  return (
    <RichInteractiveText
      text={node.text}
      keyPrefix={`node:${node.id}`}
      label={name}
      onRoll={onRoll}
      results={results}
      limitedUses={limitedUses}
      onLimitedUseChange={onLimitedUseChange}
    />
  );
}

export function StaticRichText({ text }: { text: string }) {
  const pattern = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/gu;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(<span key={`plain-${index++}`}>{text.slice(cursor, start)}</span>);
    const source = match[0];
    const boldItalic = source.startsWith("***");
    const bold = !boldItalic && source.startsWith("**");
    const inner = boldItalic ? source.slice(3, -3) : bold ? source.slice(2, -2) : source.slice(1, -1);
    nodes.push(
      boldItalic ? (
        <strong key={`mark-${index++}`}>
          <em>{inner}</em>
        </strong>
      ) : bold ? (
        <strong key={`mark-${index++}`}>{inner}</strong>
      ) : (
        <em key={`mark-${index++}`}>{inner}</em>
      ),
    );
    cursor = start + source.length;
  }
  if (cursor < text.length) nodes.push(<span key={`plain-${index}`}>{text.slice(cursor)}</span>);
  return <>{nodes}</>;
}

export function BodyParagraphPreview({ text }: { text: string }) {
  return <StaticRichText text={text} />;
}
