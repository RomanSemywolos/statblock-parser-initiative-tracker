import type { CardConfig, EditableStatblockDocument } from "./productModel.js";

export type CombatHpState = {
  baseMax: number;
  current: number;
  temp: number;
  maxModifier: number;
};

export type StatblockCombatant = {
  formatVersion: "statblock-combatant-v3";
  id: string;
  kind: "statblock";
  statblockId: string;
  /** Snapshot captured for encounter-card presentation and source fallback. */
  document: EditableStatblockDocument;
  /** Snapshot of which statblock content is shown on this combatant card. */
  cardConfig: CardConfig;
  nameOverride: string | null;
  armorClassOverride?: number | null;
  savingThrowOverrides?: Partial<Record<StubAbilityKey, number | null>>;
  /** Remaining source-backed limited uses, keyed by stable rendered token id. */
  limitedUses: Record<string, number>;
  hp: CombatHpState | null;
  initiativeModifier: number;
  initiativeRoll: number | null;
  createdAt: string;
};

export type StubAbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type StubCombatant = {
  formatVersion: "stub-combatant-v2";
  id: string;
  kind: "stub";
  displayName: string;
  hp: CombatHpState | null;
  armorClass: number | null;
  initiativeModifier: number;
  initiativeRoll: number | null;
  savingThrows: Record<StubAbilityKey, number | null>;
  createdAt: string;
};

export type Combatant = StatblockCombatant | StubCombatant;

export type EncounterState = {
  formatVersion: "encounter-v3";
  combatants: Combatant[];
  active: boolean;
  round: number | null;
  currentCombatantId: string | null;
  updatedAt: string;
};

export type CreateStatblockCombatantOptions = {
  id?: string;
  now?: string;
  idFactory?: () => string;
  document?: EditableStatblockDocument;
  cardConfig?: CardConfig;
  nameOverride?: string | null;
  hitPointMaximum?: number | null;
  initiativeModifier?: number | null;
};

export type CreateStubCombatantOptions = {
  id?: string;
  now?: string;
  idFactory?: () => string;
  displayName?: string | null;
  hitPointMaximum?: number | null;
  armorClass?: number | null;
  initiativeModifier?: number | null;
  savingThrows?: Partial<Record<StubAbilityKey, number | null>>;
};

function resolveNow(now?: string): string {
  return now ?? new Date().toISOString();
}

function resolveId(options: { id?: string; idFactory?: () => string }): string {
  if (options.id !== undefined) return options.id;
  if (options.idFactory !== undefined) return options.idFactory();
  return crypto.randomUUID();
}

function normalizeNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function normalizeSignedInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.trunc(value);
}

export function createCombatHpState(baseMax: number): CombatHpState {
  const normalizedMax = normalizeNonNegativeInteger(baseMax);
  return {
    baseMax: normalizedMax,
    current: normalizedMax,
    temp: 0,
    maxModifier: 0,
  };
}

export function effectiveCombatHpMaximum(hp: CombatHpState): number {
  return Math.max(0, hp.baseMax + hp.maxModifier);
}

export function damageCombatHp(hp: CombatHpState, amount: number): CombatHpState {
  const damage = normalizeNonNegativeInteger(amount);
  if (damage === 0) return hp;

  const absorbedByTemp = Math.min(hp.temp, damage);
  const remaining = damage - absorbedByTemp;
  return {
    ...hp,
    temp: hp.temp - absorbedByTemp,
    current: Math.max(0, hp.current - remaining),
  };
}

export function healCombatHp(hp: CombatHpState, amount: number): CombatHpState {
  const healing = normalizeNonNegativeInteger(amount);
  if (healing === 0) return hp;
  const current = Math.min(effectiveCombatHpMaximum(hp), hp.current + healing);
  return current === hp.current ? hp : { ...hp, current };
}

export function grantTemporaryCombatHp(hp: CombatHpState, amount: number): CombatHpState {
  const temp = normalizeNonNegativeInteger(amount);
  if (temp <= hp.temp) return hp;
  return { ...hp, temp };
}

export function modifyCombatHpMaximum(hp: CombatHpState, delta: number): CombatHpState {
  const change = normalizeSignedInteger(delta);
  if (change === 0) return hp;
  const next = { ...hp, maxModifier: hp.maxModifier + change };
  const effectiveMax = effectiveCombatHpMaximum(next);
  if (next.current > effectiveMax) next.current = effectiveMax;
  return next;
}

export function resetCombatHp(hp: CombatHpState): CombatHpState {
  if (hp.current === hp.baseMax && hp.temp === 0 && hp.maxModifier === 0) return hp;
  return createCombatHpState(hp.baseMax);
}

export function createEmptyEncounter(now?: string): EncounterState {
  return {
    formatVersion: "encounter-v3",
    combatants: [],
    active: false,
    round: null,
    currentCombatantId: null,
    updatedAt: resolveNow(now),
  };
}

function fallbackCombatantDocument(
  hitPointMaximum: number | null,
  initiativeModifier: number,
): EditableStatblockDocument {
  const abilities = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  const savingThrows = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  return {
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: null,
      subtitle: null,
      primaryRows: [],
      abilities,
      savingThrows,
      secondaryRows: [],
      evidence: [],
    },
    body: [],
    facts: {
      name: null,
      armorClass: null,
      hitPointMaximum,
      initiative: { modifier: initiativeModifier, provenance: "printed" },
      abilities,
      savingThrows,
      proficiencyBonus: null,
    },
  };
}

export function createStatblockCombatant(
  statblockId: string,
  options: CreateStatblockCombatantOptions,
): StatblockCombatant {
  const timestamp = resolveNow(options.now);
  const sourceDocument = options.document;
  const hitPointMaximum = options.hitPointMaximum ?? sourceDocument?.facts.hitPointMaximum ?? null;
  const initiativeModifier = options.initiativeModifier ?? sourceDocument?.facts.initiative?.modifier ?? 0;
  const document = sourceDocument ?? fallbackCombatantDocument(hitPointMaximum, initiativeModifier);
  return {
    formatVersion: "statblock-combatant-v3",
    id: resolveId(options),
    kind: "statblock",
    statblockId,
    document: structuredClone(document),
    cardConfig: structuredClone(
      options.cardConfig ?? {
        showName: true,
        showArmorClass: true,
        showSavingThrows: true,
        customContentIds: [],
      },
    ),
    nameOverride: options.nameOverride?.trim() || null,
    armorClassOverride: undefined,
    savingThrowOverrides: {},
    limitedUses: {},
    hp: hitPointMaximum === null ? null : createCombatHpState(hitPointMaximum),
    initiativeModifier: normalizeSignedInteger(initiativeModifier),
    initiativeRoll: null,
    createdAt: timestamp,
  };
}

export function createStubCombatant(options: CreateStubCombatantOptions = {}): StubCombatant {
  const timestamp = resolveNow(options.now);
  const hitPointMaximum = options.hitPointMaximum ?? null;
  const savingThrows: Record<StubAbilityKey, number | null> = {
    str: options.savingThrows?.str ?? null,
    dex: options.savingThrows?.dex ?? null,
    con: options.savingThrows?.con ?? null,
    int: options.savingThrows?.int ?? null,
    wis: options.savingThrows?.wis ?? null,
    cha: options.savingThrows?.cha ?? null,
  };
  return {
    formatVersion: "stub-combatant-v2",
    id: resolveId(options),
    kind: "stub",
    displayName: options.displayName?.trim() || "Без назви",
    hp: hitPointMaximum === null ? null : createCombatHpState(hitPointMaximum),
    armorClass:
      options.armorClass === null || options.armorClass === undefined
        ? null
        : normalizeNonNegativeInteger(options.armorClass),
    initiativeModifier: normalizeSignedInteger(options.initiativeModifier ?? 0),
    initiativeRoll: null,
    savingThrows,
    createdAt: timestamp,
  };
}

export function addStubCombatant(encounter: EncounterState, options: CreateStubCombatantOptions = {}): EncounterState {
  const combatant = createStubCombatant(options);
  return {
    ...encounter,
    combatants: [...encounter.combatants, combatant],
    updatedAt: combatant.createdAt,
  };
}

export function addStatblockCombatant(
  encounter: EncounterState,
  statblockId: string,
  options: CreateStatblockCombatantOptions,
): EncounterState {
  const combatant = createStatblockCombatant(statblockId, options);
  return {
    ...encounter,
    combatants: [...encounter.combatants, combatant],
    updatedAt: combatant.createdAt,
  };
}

export function setCombatantNameOverride(
  encounter: EncounterState,
  combatantId: string,
  name: string | null,
  now?: string,
): EncounterState {
  const normalized = name?.trim() || null;
  let changed = false;
  const combatants = encounter.combatants.map((entry) => {
    if (entry.id !== combatantId || entry.kind !== "statblock") return entry;
    if (entry.nameOverride === normalized) return entry;
    changed = true;
    return { ...entry, nameOverride: normalized };
  });
  return changed ? { ...encounter, combatants, updatedAt: resolveNow(now) } : encounter;
}

export type StatblockCombatantCardPatch = {
  name?: string | null;
  hitPointMaximum?: number | null;
  armorClass?: number | null;
  initiativeModifier?: number | null;
  savingThrows?: Partial<Record<StubAbilityKey, number | null>>;
};

export function updateStatblockCombatantCard(
  encounter: EncounterState,
  combatantId: string,
  patch: StatblockCombatantCardPatch,
  now?: string,
): EncounterState {
  let changed = false;
  const combatants = encounter.combatants.map((entry) => {
    if (entry.id !== combatantId || entry.kind !== "statblock") return entry;
    changed = true;
    const hp =
      patch.hitPointMaximum === undefined
        ? entry.hp
        : patch.hitPointMaximum === null
          ? null
          : entry.hp === null
            ? createCombatHpState(patch.hitPointMaximum)
            : (() => {
                const wasFull = entry.hp.current === effectiveCombatHpMaximum(entry.hp);
                const baseMax = normalizeNonNegativeInteger(patch.hitPointMaximum);
                const nextHp = { ...entry.hp, baseMax };
                nextHp.current = wasFull
                  ? effectiveCombatHpMaximum(nextHp)
                  : Math.min(nextHp.current, effectiveCombatHpMaximum(nextHp));
                return nextHp;
              })();
    return {
      ...entry,
      nameOverride: patch.name === undefined ? entry.nameOverride : patch.name?.trim() || null,
      hp,
      armorClassOverride: patch.armorClass === undefined ? entry.armorClassOverride : patch.armorClass,
      initiativeModifier:
        patch.initiativeModifier === undefined
          ? entry.initiativeModifier
          : normalizeSignedInteger(patch.initiativeModifier ?? 0),
      savingThrowOverrides:
        patch.savingThrows === undefined
          ? entry.savingThrowOverrides
          : { ...(entry.savingThrowOverrides ?? {}), ...patch.savingThrows },
    };
  });
  return changed ? { ...encounter, combatants, updatedAt: resolveNow(now) } : encounter;
}

export function updateStatblockCombatantCardConfig(
  encounter: EncounterState,
  combatantId: string,
  cardConfig: CardConfig,
  now?: string,
): EncounterState {
  let changed = false;
  const combatants = encounter.combatants.map((entry) => {
    if (entry.id !== combatantId || entry.kind !== "statblock") return entry;
    changed = true;
    return { ...entry, cardConfig: structuredClone(cardConfig) };
  });
  return changed ? { ...encounter, combatants, updatedAt: resolveNow(now) } : encounter;
}

export function updateStatblockCombatantDocument(
  encounter: EncounterState,
  combatantId: string,
  document: EditableStatblockDocument,
  now?: string,
): EncounterState {
  let changed = false;
  const combatants = encounter.combatants.map((entry) => {
    if (entry.id !== combatantId || entry.kind !== "statblock") return entry;
    changed = true;
    return {
      ...entry,
      document: structuredClone(document),
      initiativeModifier: normalizeSignedInteger(document.facts.initiative?.modifier ?? entry.initiativeModifier),
    };
  });
  return changed ? { ...encounter, combatants, updatedAt: resolveNow(now) } : encounter;
}

export function setStatblockCombatantLimitedUse(
  encounter: EncounterState,
  combatantId: string,
  key: string,
  maximum: number,
  value: number,
  now?: string,
): EncounterState {
  const normalizedMaximum = normalizeNonNegativeInteger(maximum);
  const normalizedValue = Math.min(normalizedMaximum, normalizeNonNegativeInteger(value));
  let changed = false;
  const combatants = encounter.combatants.map((entry) => {
    if (entry.id !== combatantId || entry.kind !== "statblock") return entry;
    const current = entry.limitedUses[key] ?? normalizedMaximum;
    if (current === normalizedValue) return entry;
    changed = true;
    return { ...entry, limitedUses: { ...entry.limitedUses, [key]: normalizedValue } };
  });
  return changed ? { ...encounter, combatants, updatedAt: resolveNow(now) } : encounter;
}

export type StubCombatantPatch = {
  displayName?: string;
  hitPointMaximum?: number | null;
  armorClass?: number | null;
  initiativeModifier?: number;
  savingThrows?: Partial<Record<StubAbilityKey, number | null>>;
};

export function updateStubCombatant(
  encounter: EncounterState,
  combatantId: string,
  patch: StubCombatantPatch,
  now?: string,
): EncounterState {
  let changed = false;
  const combatants = encounter.combatants.map((entry) => {
    if (entry.id !== combatantId || entry.kind !== "stub") return entry;
    changed = true;
    const savingThrows =
      patch.savingThrows === undefined ? entry.savingThrows : { ...entry.savingThrows, ...patch.savingThrows };
    const hp =
      patch.hitPointMaximum === undefined
        ? entry.hp
        : patch.hitPointMaximum === null
          ? null
          : entry.hp === null
            ? createCombatHpState(patch.hitPointMaximum)
            : (() => {
                const wasFull = entry.hp.current === effectiveCombatHpMaximum(entry.hp);
                const baseMax = normalizeNonNegativeInteger(patch.hitPointMaximum);
                const nextHp = { ...entry.hp, baseMax };
                nextHp.current = wasFull
                  ? effectiveCombatHpMaximum(nextHp)
                  : Math.min(nextHp.current, effectiveCombatHpMaximum(nextHp));
                return nextHp;
              })();
    return {
      ...entry,
      displayName: patch.displayName === undefined ? entry.displayName : patch.displayName.trim() || "Без назви",
      hp,
      armorClass:
        patch.armorClass === undefined
          ? entry.armorClass
          : patch.armorClass === null
            ? null
            : normalizeNonNegativeInteger(patch.armorClass),
      initiativeModifier:
        patch.initiativeModifier === undefined
          ? entry.initiativeModifier
          : normalizeSignedInteger(patch.initiativeModifier),
      savingThrows,
    };
  });
  return changed ? { ...encounter, combatants, updatedAt: resolveNow(now) } : encounter;
}

function successorAfterRemoval(
  encounter: EncounterState,
  removedIds: ReadonlySet<string>,
): { id: string | null; wrapped: boolean } {
  if (encounter.currentCombatantId === null || !removedIds.has(encounter.currentCombatantId)) {
    return { id: encounter.currentCombatantId, wrapped: false };
  }

  const ordered = orderedEncounterCombatants(encounter);
  const currentIndex = ordered.findIndex((entry) => entry.id === encounter.currentCombatantId);
  if (currentIndex < 0) return { id: null, wrapped: false };

  for (let offset = 1; offset < ordered.length; offset += 1) {
    const index = (currentIndex + offset) % ordered.length;
    const candidate = ordered[index];
    if (candidate !== undefined && !removedIds.has(candidate.id)) {
      return { id: candidate.id, wrapped: index <= currentIndex };
    }
  }
  return { id: null, wrapped: false };
}

export function removeCombatant(encounter: EncounterState, combatantId: string, now?: string): EncounterState {
  const combatants = encounter.combatants.filter((entry) => entry.id !== combatantId);
  if (combatants.length === encounter.combatants.length) return encounter;
  const removedIds = new Set([combatantId]);
  const successor = encounter.active
    ? successorAfterRemoval(encounter, removedIds)
    : { id: encounter.currentCombatantId === combatantId ? null : encounter.currentCombatantId, wrapped: false };
  const updated: EncounterState = {
    ...encounter,
    combatants,
    currentCombatantId: successor.id,
    round: encounter.active && successor.wrapped ? (encounter.round ?? 1) + 1 : encounter.round,
    updatedAt: resolveNow(now),
  };
  if (combatants.length === 0) {
    return { ...updated, active: false, round: null, currentCombatantId: null };
  }
  return updated;
}

export function removeCombatantsForStatblock(
  encounter: EncounterState,
  statblockId: string,
  now?: string,
): EncounterState {
  const removedIds = new Set(
    encounter.combatants
      .filter((entry) => entry.kind === "statblock" && entry.statblockId === statblockId)
      .map((entry) => entry.id),
  );
  if (removedIds.size === 0) return encounter;
  const combatants = encounter.combatants.filter((entry) => !removedIds.has(entry.id));
  const successor = encounter.active
    ? successorAfterRemoval(encounter, removedIds)
    : {
        id:
          encounter.currentCombatantId !== null && removedIds.has(encounter.currentCombatantId)
            ? null
            : encounter.currentCombatantId,
        wrapped: false,
      };
  const updated: EncounterState = {
    ...encounter,
    combatants,
    currentCombatantId: successor.id,
    round: encounter.active && successor.wrapped ? (encounter.round ?? 1) + 1 : encounter.round,
    updatedAt: resolveNow(now),
  };
  if (combatants.length === 0) {
    return { ...updated, active: false, round: null, currentCombatantId: null };
  }
  return updated;
}

function mutateCombatantHp(
  encounter: EncounterState,
  combatantId: string,
  update: (hp: CombatHpState) => CombatHpState,
  now?: string,
): EncounterState {
  let changed = false;
  const combatants = encounter.combatants.map((entry) => {
    if (entry.id !== combatantId || entry.hp === null) return entry;
    const hp = update(entry.hp);
    if (hp === entry.hp) return entry;
    changed = true;
    return { ...entry, hp };
  });
  if (!changed) return encounter;
  return { ...encounter, combatants, updatedAt: resolveNow(now) };
}

export function damageCombatant(
  encounter: EncounterState,
  combatantId: string,
  amount: number,
  now?: string,
): EncounterState {
  return mutateCombatantHp(encounter, combatantId, (hp) => damageCombatHp(hp, amount), now);
}

export function healCombatant(
  encounter: EncounterState,
  combatantId: string,
  amount: number,
  now?: string,
): EncounterState {
  return mutateCombatantHp(encounter, combatantId, (hp) => healCombatHp(hp, amount), now);
}

export function grantTemporaryHpToCombatant(
  encounter: EncounterState,
  combatantId: string,
  amount: number,
  now?: string,
): EncounterState {
  return mutateCombatantHp(encounter, combatantId, (hp) => grantTemporaryCombatHp(hp, amount), now);
}

export function modifyCombatantHpMaximum(
  encounter: EncounterState,
  combatantId: string,
  delta: number,
  now?: string,
): EncounterState {
  return mutateCombatantHp(encounter, combatantId, (hp) => modifyCombatHpMaximum(hp, delta), now);
}

export function resetCombatantHp(encounter: EncounterState, combatantId: string, now?: string): EncounterState {
  return mutateCombatantHp(encounter, combatantId, resetCombatHp, now);
}

export function updateCombatantHp(
  encounter: EncounterState,
  combatantId: string,
  hp: CombatHpState,
  now?: string,
): EncounterState {
  return mutateCombatantHp(encounter, combatantId, () => ({ ...hp }), now);
}

export function initializeCombatantHp(
  encounter: EncounterState,
  combatantId: string,
  baseMax: number,
  now?: string,
): EncounterState {
  let changed = false;
  const combatants = encounter.combatants.map((entry) => {
    if (entry.id !== combatantId || entry.hp !== null) return entry;
    changed = true;
    return { ...entry, hp: createCombatHpState(baseMax) };
  });
  if (!changed) return encounter;
  return { ...encounter, combatants, updatedAt: resolveNow(now) };
}

export type InitiativeRandomSource = () => number;

function rollD20(random: InitiativeRandomSource): number {
  const raw = random();
  const bounded = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 0.9999999999999999) : 0;
  return Math.floor(bounded * 20) + 1;
}

export function orderedEncounterCombatants(encounter: EncounterState): Combatant[] {
  return encounter.combatants
    .map((combatant, insertionIndex) => ({ combatant, insertionIndex }))
    .sort((left, right) => {
      const leftRoll = left.combatant.initiativeRoll;
      const rightRoll = right.combatant.initiativeRoll;
      if (leftRoll === null && rightRoll !== null) return 1;
      if (leftRoll !== null && rightRoll === null) return -1;
      if (leftRoll !== null && rightRoll !== null && leftRoll !== rightRoll) return rightRoll - leftRoll;
      if (
        leftRoll !== null &&
        rightRoll !== null &&
        left.combatant.initiativeModifier !== right.combatant.initiativeModifier
      ) {
        return right.combatant.initiativeModifier - left.combatant.initiativeModifier;
      }
      return left.insertionIndex - right.insertionIndex;
    })
    .map(({ combatant }) => combatant);
}

export function setCombatantInitiative(
  encounter: EncounterState,
  combatantId: string,
  initiativeRoll: number | null,
  now?: string,
): EncounterState {
  let changed = false;
  const normalized =
    initiativeRoll === null ? null : Number.isFinite(initiativeRoll) ? Math.trunc(initiativeRoll) : null;
  const combatants = encounter.combatants.map((entry) => {
    if (entry.id !== combatantId) return entry;
    changed = true;
    return { ...entry, initiativeRoll: normalized };
  });
  if (!changed) return encounter;
  return { ...encounter, combatants, updatedAt: resolveNow(now) };
}

export function rollCombatantInitiative(
  encounter: EncounterState,
  combatantId: string,
  random: InitiativeRandomSource = Math.random,
  now?: string,
): EncounterState {
  let changed = false;
  const combatants = encounter.combatants.map((entry) => {
    if (entry.id !== combatantId) return entry;
    changed = true;
    return { ...entry, initiativeRoll: rollD20(random) + entry.initiativeModifier };
  });
  if (!changed) return encounter;
  return { ...encounter, combatants, updatedAt: resolveNow(now) };
}

export function startCombat(
  encounter: EncounterState,
  random: InitiativeRandomSource = Math.random,
  now?: string,
): EncounterState {
  if (encounter.combatants.length === 0) return encounter;
  const combatants = encounter.combatants.map((entry) =>
    entry.initiativeRoll === null ? { ...entry, initiativeRoll: rollD20(random) + entry.initiativeModifier } : entry,
  );
  const staged: EncounterState = {
    ...encounter,
    combatants,
    active: true,
    round: 1,
    currentCombatantId: null,
    updatedAt: resolveNow(now),
  };
  const first = orderedEncounterCombatants(staged)[0] ?? null;
  return { ...staged, currentCombatantId: first?.id ?? null };
}

export function advanceCombatTurn(encounter: EncounterState, now?: string): EncounterState {
  if (!encounter.active || encounter.combatants.length === 0) return encounter;
  const ordered = orderedEncounterCombatants(encounter);
  if (ordered.length === 0) return encounter;
  const currentIndex =
    encounter.currentCombatantId === null
      ? -1
      : ordered.findIndex((entry) => entry.id === encounter.currentCombatantId);
  if (currentIndex < 0) {
    return {
      ...encounter,
      currentCombatantId: ordered[0]?.id ?? null,
      round: encounter.round ?? 1,
      updatedAt: resolveNow(now),
    };
  }
  const wrapped = currentIndex >= ordered.length - 1;
  const next = wrapped ? ordered[0] : ordered[currentIndex + 1];
  return {
    ...encounter,
    currentCombatantId: next?.id ?? null,
    round: wrapped ? (encounter.round ?? 1) + 1 : (encounter.round ?? 1),
    updatedAt: resolveNow(now),
  };
}

export function endCombat(encounter: EncounterState, now?: string): EncounterState {
  const combatants = encounter.combatants.map((entry) => ({
    ...entry,
    initiativeRoll: null,
    hp: entry.hp === null ? null : resetCombatHp(entry.hp),
  }));
  return {
    ...encounter,
    combatants,
    active: false,
    round: null,
    currentCombatantId: null,
    updatedAt: resolveNow(now),
  };
}
