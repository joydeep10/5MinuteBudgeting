import { describe, expect, it } from "vitest";

import { budgetPlanSchemaVersion, simulateBudgetPlan } from "../src/domain";
import type {
  BalanceSnapshot,
  BudgetPlan,
  CommitmentTemplate,
  Money,
  SavingsGoal,
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

const commitment = (
  overrides: Partial<CommitmentTemplate> & Pick<CommitmentTemplate, "id">,
): CommitmentTemplate => ({
  id: overrides.id,
  createdAt: "2026-06-01T08:00:00.000Z",
  updatedAt: "2026-06-01T08:00:00.000Z",
  name: overrides.name ?? overrides.id,
  kind: overrides.kind ?? "bill",
  amount: overrides.amount ?? money(0),
  active: overrides.active ?? true,
  startsOn: overrides.startsOn ?? "2026-06-01",
  endsOn: overrides.endsOn,
  recurrence: overrides.recurrence ?? {
    frequency: "one-time",
    interval: 1,
    anchorDate: overrides.startsOn ?? "2026-06-01",
  },
  categoryId: overrides.categoryId,
});

const goal = (
  overrides: Partial<SavingsGoal> & Pick<SavingsGoal, "id">,
): SavingsGoal => ({
  id: overrides.id,
  createdAt: "2026-06-01T08:00:00.000Z",
  updatedAt: "2026-06-01T08:00:00.000Z",
  name: overrides.name ?? overrides.id,
  targetAmount: overrides.targetAmount ?? money(0),
  currentAmount: overrides.currentAmount ?? money(0),
  targetDate: overrides.targetDate,
  status: overrides.status ?? "active",
  protected: overrides.protected ?? true,
  priority: overrides.priority,
  periodContributionOverride: overrides.periodContributionOverride,
});

const plan = (
  overrides: {
    fixedBuffer?: Money;
    balanceSnapshots?: readonly BalanceSnapshot[];
    commitmentTemplates?: readonly CommitmentTemplate[];
    savingsGoals?: readonly SavingsGoal[];
  } = {},
): BudgetPlan => ({
  schemaVersion: budgetPlanSchemaVersion,
  id: "budget_simulator",
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
  fixedBuffer: overrides.fixedBuffer ?? money(0),
  plannedRecords: {
    categories: [],
    incomeTemplates: [],
    commitmentTemplates: overrides.commitmentTemplates ?? [],
    savingsGoals: overrides.savingsGoals ?? [],
    flexibleCategoryGuidance: [],
  },
  balanceSnapshots: overrides.balanceSnapshots ?? [],
  financialEvents: [],
});

describe("what-if simulator", () => {
  it("applies a one-time spend to a copied plan and compares it with the current result", () => {
    const original = plan({
      balanceSnapshots: [
        snapshot({
          id: "snapshot_opening",
          amount: money(100_000),
        }),
      ],
    });

    const result = simulateBudgetPlan({
      plan: original,
      today: "2026-06-10",
      scenarios: [
        {
          kind: "one-time-spend",
          id: "scenario_dinner",
          date: "2026-06-10",
          amount: money(15_000),
        },
      ],
    });

    expect(original.financialEvents).toEqual([]);
    expect(result.current.confirmed.rawSafePool).toBe(100_000);
    expect(result.simulated.confirmed.rawSafePool).toBe(85_000);
    expect(result.difference).toEqual(
      expect.objectContaining({
        rawSafePool: -15_000,
        safeThisPeriod: -15_000,
        effectiveAvailableMoney: -15_000,
      }),
    );
  });

  it("compares safer, tighter, and shortfall scenarios through the calculator", () => {
    const original = plan({
      fixedBuffer: money(10_000),
      balanceSnapshots: [
        snapshot({
          id: "snapshot_opening",
          amount: money(80_000),
        }),
      ],
      commitmentTemplates: [
        commitment({
          id: "bill_rent",
          amount: money(30_000),
          startsOn: "2026-06-20",
        }),
      ],
    });

    const safer = simulateBudgetPlan({
      plan: original,
      today: "2026-06-10",
      scenarios: [
        {
          kind: "available-money-adjustment",
          id: "scenario_extra_cash",
          date: "2026-06-10",
          amountDelta: money(25_000),
        },
      ],
    });
    const tighter = simulateBudgetPlan({
      plan: original,
      today: "2026-06-10",
      scenarios: [
        {
          kind: "buffer-change",
          fixedBuffer: money(30_000),
        },
      ],
    });
    const shortfall = simulateBudgetPlan({
      plan: original,
      today: "2026-06-10",
      scenarios: [
        {
          kind: "commitment-add",
          commitment: commitment({
            id: "debt_tax",
            kind: "debt",
            amount: money(90_000),
            startsOn: "2026-06-15",
          }),
        },
      ],
    });

    expect(safer.difference.rawSafePool).toBe(25_000);
    expect(safer.difference.effectiveAvailableMoney).toBe(25_000);
    expect(tighter.difference.rawSafePool).toBe(-20_000);
    expect(tighter.difference.fixedBuffer).toBe(20_000);
    expect(shortfall.simulated.health).toBe("overspending");
    expect(shortfall.simulated.warnings).toEqual([
      expect.objectContaining({
        code: "critical-shortfall",
        severity: "critical",
      }),
    ]);
    expect(original.plannedRecords.commitmentTemplates).toHaveLength(1);
  });

  it("supports commitment remove/change and savings goal include or pause scenarios", () => {
    const original = plan({
      balanceSnapshots: [
        snapshot({
          id: "snapshot_opening",
          amount: money(100_000),
        }),
      ],
      commitmentTemplates: [
        commitment({
          id: "bill_rent",
          amount: money(30_000),
          startsOn: "2026-06-20",
        }),
      ],
      savingsGoals: [
        goal({
          id: "goal_emergency",
          targetAmount: money(100_000),
          currentAmount: money(20_000),
          targetDate: "2026-08-30",
          protected: true,
          periodContributionOverride: money(20_000),
        }),
      ],
    });

    const removedAndPaused = simulateBudgetPlan({
      plan: original,
      today: "2026-06-10",
      scenarios: [
        {
          kind: "commitment-remove",
          commitmentTemplateId: "bill_rent",
        },
        {
          kind: "savings-goal-change",
          savingsGoalId: "goal_emergency",
          status: "paused",
        },
      ],
    });
    const changedCommitment = simulateBudgetPlan({
      plan: original,
      today: "2026-06-10",
      scenarios: [
        {
          kind: "commitment-change",
          commitmentTemplateId: "bill_rent",
          changes: {
            amount: money(45_000),
          },
        },
      ],
    });
    const includedSavings = simulateBudgetPlan({
      plan: {
        ...original,
        plannedRecords: {
          ...original.plannedRecords,
          savingsGoals: [
            {
              ...original.plannedRecords.savingsGoals[0],
              protected: false,
            },
          ],
        },
      },
      today: "2026-06-10",
      scenarios: [
        {
          kind: "savings-goal-change",
          savingsGoalId: "goal_emergency",
          protected: true,
        },
      ],
    });

    expect(removedAndPaused.difference.unpaidCommitments).toBe(-30_000);
    expect(removedAndPaused.difference.protectedSavings).toBe(-20_000);
    expect(removedAndPaused.difference.rawSafePool).toBe(50_000);
    expect(changedCommitment.difference.unpaidCommitments).toBe(15_000);
    expect(changedCommitment.difference.rawSafePool).toBe(-15_000);
    expect(includedSavings.difference.protectedSavings).toBe(20_000);
    expect(includedSavings.difference.rawSafePool).toBe(-20_000);
    expect(original.plannedRecords.savingsGoals[0]?.status).toBe("active");
  });
});
