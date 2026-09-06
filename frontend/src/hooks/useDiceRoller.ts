import { useState } from "react";
import { parseDiceExpression, rollDice, type DiceExpression, type DiceRollResult } from "statblock-parser-core/product";

export type RollLogEntry = {
  id: string;
  label: string;
  result: DiceRollResult;
};

function createRollId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `roll-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatRollDetails(result: DiceRollResult): string {
  const dice = result.rolls.length === 1 ? String(result.rolls[0]) : `[${result.rolls.join(", ")}]`;
  if (result.modifier === 0) return `${dice} = ${result.total}`;
  return `${dice} ${result.modifier > 0 ? "+" : "−"} ${Math.abs(result.modifier)} = ${result.total}`;
}

export function useDiceRoller() {
  const [rollInput, setRollInput] = useState("1к20");
  const [rollError, setRollError] = useState<string | null>(null);
  const [rollHistory, setRollHistory] = useState<RollLogEntry[]>([]);
  const [rollSequence, setRollSequence] = useState(0);

  function performRoll(expression: DiceExpression, label: string): DiceRollResult {
    const result = rollDice(expression);
    setRollError(null);
    setRollSequence((current) => current + 1);
    setRollHistory((current) => [{ id: createRollId(), label, result }, ...current].slice(0, 10));
    return result;
  }

  function rollInputExpression() {
    const expression = parseDiceExpression(rollInput);
    if (expression === null) {
      setRollError("Не вдалося прочитати вираз. Приклад: 3d6+4 або 1к20+8.");
      return;
    }
    performRoll(expression, "Загальний кидок");
  }

  return {
    rollInput,
    setRollInput,
    rollError,
    setRollError,
    rollHistory,
    rollSequence,
    performRoll,
    rollInputExpression,
  };
}
