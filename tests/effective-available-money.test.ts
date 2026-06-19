import { describe, expect, it } from "vitest";

import {
  budgetPlanSchemaVersion,
  calculateEffectiveAvailableMoney,
} from "../src/domain";
import type {
  BalanceSnapshot,
  BudgetPlan,
  FinancialEventRecord,
  Money,
} from "../src/domain";

const money = (minorUnits: number): Money => minorUnits;

const snapshot = (
  overrides: Partial<BalanceSnapshot> & Pick<BalanceSnapshot, "id">,
): BalanceSnapshot => ({
  id: overrides.id,
  createdAt: overrides.createdAt ?? "2026-06-01T08:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-06-01T08:00:00.000Z",
  date: overrides.date ?? "2026-06-01",
  amount: overrides.amount ?? money(0),
  note: overrides.note,
});

const event = (
  overrides: Partial<FinancialEventRecord> & Pick<FinancialEventRecord, "id">,
): FinancialEventRecord => ({
  id: overrides.id,
  createdAt: overrides.createdAt ?? "2026-06-01T08:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-06-01T08:00:00.000Z",
  date: overrides.date ?? "2026-06-01",
  kind: overrides.kind ?? "spending",
  amount: overrides.amount ?? money(0),
  categoryId: overrides.categoryId,
  incomeTemplateId: overrides.incomeTemplateId,
  commitmentTemplateId: overrides.commitmentTemplateId,
  occurrenceDate: overrides.occurrenceDate,
  savingsGoalId: overrides.savingsGoalId,
  note: overrides.note,
});

const plan = (
  overrides: {
    balanceSnapshots?: readonly BalanceSnapshot[];
    financialEvents?: readonly FinancialEventRecord[];
  } = {},
): BudgetPlan => ({
  schemaVersion: budgetPlanSchemaVersion,
  id: "budget_effective_money",
  createdAt: "2026-06-01T08:00:00.000Z",
  updatedAt: "2026-06-01T08:00:00.000Z",
  mode: "general",
  currency: {
    code: "USD",
    decimalPlaces: 2,
  },
  activePeriod: {
    startDate: "2026-06-01",
    endDate: "2026-06-30",
  },
  fixedBuffer: money(0),
  plannedRecords: {
    categories: [],
    incomeTemplates: [],
    commitmentTemplates: [],
    savingsGoals: [],
    flexibleCategoryGuidance: [],
  },
  balanceSnapshots: overrides.balanceSnapshots ?? [],
  financialEvents: overrides.financialEvents ?? [],
});

describe("effective available money", () => {
  it("uses the first balance snapshot as the initial current available money", () => {
    const effectiveMoney = calculateEffectiveAvailableMoney(
      plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_opening",
            date: "2026-06-01",
            amount: money(100_000),
          }),
        ],
      }),
    );

    expect(effectiveMoney).toBe(100_000);
  });

  it("starts from the latest balance snapshot, using created time to break same-day ties", () => {
    const effectiveMoney = calculateEffectiveAvailableMoney(
      plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_opening",
            date: "2026-06-01",
            createdAt: "2026-06-01T08:00:00.000Z",
            amount: money(100_000),
          }),
          snapshot({
            id: "snapshot_same_day_older",
            date: "2026-06-10",
            createdAt: "2026-06-10T08:00:00.000Z",
            amount: money(120_000),
          }),
          snapshot({
            id: "snapshot_same_day_newer",
            date: "2026-06-10",
            createdAt: "2026-06-10T09:00:00.000Z",
            amount: money(130_000),
          }),
        ],
        financialEvents: [
          event({
            id: "old_spending",
            date: "2026-06-05",
            createdAt: "2026-06-05T08:00:00.000Z",
            kind: "spending",
            amount: money(40_000),
          }),
        ],
      }),
    );

    expect(effectiveMoney).toBe(130_000);
  });

  it("subtracts spending after the latest snapshot while ignoring stale spending before it", () => {
    const effectiveMoney = calculateEffectiveAvailableMoney(
      plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_latest",
            date: "2026-06-10",
            createdAt: "2026-06-10T09:00:00.000Z",
            amount: money(150_000),
          }),
        ],
        financialEvents: [
          event({
            id: "stale_spending",
            date: "2026-06-09",
            createdAt: "2026-06-09T18:00:00.000Z",
            kind: "spending",
            amount: money(20_000),
          }),
          event({
            id: "current_spending",
            date: "2026-06-11",
            createdAt: "2026-06-11T08:00:00.000Z",
            kind: "spending",
            amount: money(12_500),
          }),
        ],
      }),
    );

    expect(effectiveMoney).toBe(137_500);
  });

  it("subtracts commitment payments and savings contributions after the latest snapshot", () => {
    const effectiveMoney = calculateEffectiveAvailableMoney(
      plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_latest",
            date: "2026-06-10",
            amount: money(200_000),
          }),
        ],
        financialEvents: [
          event({
            id: "rent_payment",
            date: "2026-06-11",
            kind: "commitment-payment",
            amount: money(75_000),
            commitmentTemplateId: "commitment_rent",
            occurrenceDate: "2026-06-10",
          }),
          event({
            id: "emergency_contribution",
            date: "2026-06-12",
            kind: "savings-contribution",
            amount: money(25_000),
            savingsGoalId: "goal_emergency",
          }),
        ],
      }),
    );

    expect(effectiveMoney).toBe(100_000);
  });

  it("adds confirmed income received after the latest snapshot", () => {
    const effectiveMoney = calculateEffectiveAvailableMoney(
      plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_latest",
            date: "2026-06-10",
            amount: money(80_000),
          }),
        ],
        financialEvents: [
          event({
            id: "paycheck_received",
            date: "2026-06-15",
            kind: "income-received",
            amount: money(140_000),
            incomeTemplateId: "income_paycheck",
          }),
        ],
      }),
    );

    expect(effectiveMoney).toBe(220_000);
  });

  it("uses same-day event created time to decide whether it happened after the selected snapshot", () => {
    const effectiveMoney = calculateEffectiveAvailableMoney(
      plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_midday",
            date: "2026-06-10",
            createdAt: "2026-06-10T12:00:00.000Z",
            amount: money(90_000),
          }),
        ],
        financialEvents: [
          event({
            id: "morning_spend",
            date: "2026-06-10",
            createdAt: "2026-06-10T09:00:00.000Z",
            kind: "spending",
            amount: money(25_000),
          }),
          event({
            id: "afternoon_spend",
            date: "2026-06-10",
            createdAt: "2026-06-10T15:00:00.000Z",
            kind: "spending",
            amount: money(10_000),
          }),
        ],
      }),
    );

    expect(effectiveMoney).toBe(80_000);
  });

  it("ignores financial events outside the active budget period", () => {
    const effectiveMoney = calculateEffectiveAvailableMoney(
      plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_latest",
            date: "2026-06-10",
            amount: money(100_000),
          }),
        ],
        financialEvents: [
          event({
            id: "future_spending",
            date: "2026-07-01",
            createdAt: "2026-07-01T08:00:00.000Z",
            kind: "spending",
            amount: money(20_000),
          }),
          event({
            id: "future_income",
            date: "2026-07-02",
            createdAt: "2026-07-02T08:00:00.000Z",
            kind: "income-received",
            amount: money(50_000),
          }),
        ],
      }),
    );

    expect(effectiveMoney).toBe(100_000);
  });
});
