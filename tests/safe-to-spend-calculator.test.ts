import { describe, expect, it } from "vitest";

import {
  budgetPlanSchemaVersion,
  calculateSafeToSpend,
} from "../src/domain";
import type {
  BalanceSnapshot,
  BudgetPlan,
  Category,
  CommitmentTemplate,
  FinancialEventRecord,
  FlexibleCategoryGuidance,
  IncomeTemplate,
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

const category = (
  overrides: Partial<Category> & Pick<Category, "id" | "name">,
): Category => ({
  id: overrides.id,
  createdAt: overrides.createdAt ?? "2026-06-01T08:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-06-01T08:00:00.000Z",
  name: overrides.name,
  kind: overrides.kind ?? "flexible",
  archived: overrides.archived ?? false,
});

const guidance = (
  overrides: Partial<FlexibleCategoryGuidance> &
    Pick<FlexibleCategoryGuidance, "id" | "categoryId">,
): FlexibleCategoryGuidance => ({
  id: overrides.id,
  createdAt: overrides.createdAt ?? "2026-06-01T08:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-06-01T08:00:00.000Z",
  categoryId: overrides.categoryId,
  periodLimit: overrides.periodLimit ?? money(0),
  reserved: overrides.reserved ?? false,
});

const income = (
  overrides: Partial<IncomeTemplate> & Pick<IncomeTemplate, "id">,
): IncomeTemplate => ({
  id: overrides.id,
  createdAt: "2026-06-01T08:00:00.000Z",
  updatedAt: "2026-06-01T08:00:00.000Z",
  name: overrides.name ?? overrides.id,
  amount: overrides.amount ?? money(0),
  active: overrides.active ?? true,
  startsOn: overrides.startsOn ?? "2026-06-01",
  endsOn: overrides.endsOn,
  recurrence: overrides.recurrence ?? {
    frequency: "one-time",
    interval: 1,
    anchorDate: overrides.startsOn ?? "2026-06-01",
  },
  includeInProjection: overrides.includeInProjection ?? false,
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
    activePeriod?: BudgetPlan["activePeriod"];
    fixedBuffer?: Money;
    balanceSnapshots?: readonly BalanceSnapshot[];
    financialEvents?: readonly FinancialEventRecord[];
    categories?: readonly Category[];
    flexibleCategoryGuidance?: readonly FlexibleCategoryGuidance[];
    commitmentTemplates?: readonly CommitmentTemplate[];
    incomeTemplates?: readonly IncomeTemplate[];
    savingsGoals?: readonly SavingsGoal[];
  } = {},
): BudgetPlan => ({
  schemaVersion: budgetPlanSchemaVersion,
  id: "budget_safe_to_spend",
  createdAt: "2026-06-01T08:00:00.000Z",
  updatedAt: "2026-06-01T08:00:00.000Z",
  mode: "general",
  currency: {
    code: "USD",
    decimalPlaces: 2,
  },
  activePeriod: {
    startDate: overrides.activePeriod?.startDate ?? "2026-06-01",
    endDate: overrides.activePeriod?.endDate ?? "2026-06-30",
  },
  fixedBuffer: overrides.fixedBuffer ?? money(0),
  plannedRecords: {
    categories: overrides.categories ?? [],
    incomeTemplates: overrides.incomeTemplates ?? [],
    commitmentTemplates: overrides.commitmentTemplates ?? [],
    savingsGoals: overrides.savingsGoals ?? [],
    flexibleCategoryGuidance: overrides.flexibleCategoryGuidance ?? [],
  },
  balanceSnapshots: overrides.balanceSnapshots ?? [],
  financialEvents: overrides.financialEvents ?? [],
});

describe("safe-to-spend calculator", () => {
  it("calculates the confirmed safe-to-spend answer from confirmed money, obligations, savings, and buffer", () => {
    const result = calculateSafeToSpend({
      plan: plan({
        fixedBuffer: money(10_000),
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
            currentAmount: money(40_000),
            periodContributionOverride: money(15_000),
          }),
        ],
      }),
      today: "2026-06-10",
    });

    expect(result.confirmed).toEqual({
      rawSafePool: 45_000,
      safeThisPeriod: 45_000,
      safeToday: 2_142,
      safeThisWeek: 14_994,
    });
    expect(result.breakdown).toEqual(
      expect.objectContaining({
        effectiveAvailableMoney: 100_000,
        unpaidCommitments: 30_000,
        protectedSavings: 15_000,
        fixedBuffer: 10_000,
      }),
    );
    expect(result.health).toBe("safe");
  });

  it("keeps future income out of confirmed safety while returning marked income in projected safety", () => {
    const result = calculateSafeToSpend({
      plan: plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_opening",
            amount: money(20_000),
          }),
        ],
        incomeTemplates: [
          income({
            id: "income_projected_paycheck",
            amount: money(50_000),
            startsOn: "2026-06-15",
            includeInProjection: true,
          }),
          income({
            id: "income_unmarked_side_work",
            amount: money(40_000),
            startsOn: "2026-06-16",
            includeInProjection: false,
          }),
          income({
            id: "income_inactive_marked",
            amount: money(30_000),
            startsOn: "2026-06-17",
            active: false,
            includeInProjection: true,
          }),
          income({
            id: "income_after_period",
            amount: money(90_000),
            startsOn: "2026-07-01",
            includeInProjection: true,
          }),
        ],
      }),
      today: "2026-06-10",
    });

    expect(result.confirmed.rawSafePool).toBe(20_000);
    expect(result.projected.rawSafePool).toBe(70_000);
    expect(result.breakdown.projectedIncome).toBe(50_000);
  });

  it("keeps displayed safe amounts at zero for a same-day shortfall", () => {
    const result = calculateSafeToSpend({
      plan: plan({
        activePeriod: {
          startDate: "2026-06-30",
          endDate: "2026-06-30",
        },
        fixedBuffer: money(5_000),
        balanceSnapshots: [
          snapshot({
            id: "snapshot_opening",
            date: "2026-06-30",
            amount: money(20_000),
          }),
        ],
        commitmentTemplates: [
          commitment({
            id: "bill_rent",
            amount: money(30_000),
            startsOn: "2026-06-30",
          }),
        ],
      }),
      today: "2026-06-30",
    });

    expect(result.confirmed).toEqual({
      rawSafePool: -15_000,
      safeThisPeriod: 0,
      safeToday: 0,
      safeThisWeek: 0,
    });
    expect(result.health).toBe("overspending");
  });

  it("deducts unpaid commitments inside the active period and ignores later commitments", () => {
    const result = calculateSafeToSpend({
      plan: plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_opening",
            amount: money(100_000),
          }),
        ],
        commitmentTemplates: [
          commitment({
            id: "bill_inside_period",
            amount: money(25_000),
            startsOn: "2026-06-25",
          }),
          commitment({
            id: "bill_after_period",
            amount: money(75_000),
            startsOn: "2026-07-01",
          }),
        ],
      }),
      today: "2026-06-10",
    });

    expect(result.breakdown.unpaidCommitments).toBe(25_000);
    expect(result.confirmed.rawSafePool).toBe(75_000);
  });

  it("classifies health by safe-pool ratio and treats buffer compromise as risky", () => {
    const healthForRawPool = (rawSafePool: Money) =>
      calculateSafeToSpend({
        plan: plan({
          balanceSnapshots: [
            snapshot({
              id: `snapshot_${rawSafePool}`,
              amount: money(100_000),
            }),
          ],
          commitmentTemplates: [
            commitment({
              id: `commitment_${rawSafePool}`,
              amount: money(100_000 - rawSafePool),
              startsOn: "2026-06-10",
            }),
          ],
        }),
        today: "2026-06-01",
      }).health;

    expect(healthForRawPool(money(4_000))).toBe("risky");
    expect(healthForRawPool(money(20_000))).toBe("tight");
    expect(healthForRawPool(money(40_000))).toBe("safe");

    expect(
      calculateSafeToSpend({
        plan: plan({
          fixedBuffer: money(10_000),
          balanceSnapshots: [
            snapshot({
              id: "snapshot_buffer_compromise",
              amount: money(100_000),
            }),
          ],
          commitmentTemplates: [
            commitment({
              id: "bill_large",
              amount: money(85_000),
              startsOn: "2026-06-10",
            }),
          ],
        }),
        today: "2026-06-01",
      }).health,
    ).toBe("risky");
  });

  it("does not deduct flexible category guidance or overages from safe-to-spend", () => {
    const dining = category({
      id: "category_dining",
      name: "Dining out",
    });

    const result = calculateSafeToSpend({
      plan: plan({
        categories: [dining],
        flexibleCategoryGuidance: [
          guidance({
            id: "guidance_dining",
            categoryId: dining.id,
            periodLimit: money(10_000),
          }),
        ],
        balanceSnapshots: [
          snapshot({
            id: "snapshot_opening",
            amount: money(100_000),
          }),
        ],
        financialEvents: [
          event({
            id: "spend_dining",
            date: "2026-06-10",
            kind: "spending",
            amount: money(15_000),
            categoryId: dining.id,
          }),
        ],
      }),
      today: "2026-06-10",
    });

    expect(result.breakdown.effectiveAvailableMoney).toBe(85_000);
    expect(result.confirmed.rawSafePool).toBe(85_000);
  });

  it("caps safe-this-week to the remaining active-period days", () => {
    const result = calculateSafeToSpend({
      plan: plan({
        activePeriod: {
          startDate: "2026-06-10",
          endDate: "2026-06-12",
        },
        balanceSnapshots: [
          snapshot({
            id: "snapshot_short_period",
            date: "2026-06-10",
            amount: money(9_000),
          }),
        ],
      }),
      today: "2026-06-10",
    });

    expect(result.confirmed.safeToday).toBe(3_000);
    expect(result.confirmed.safeThisWeek).toBe(9_000);
  });
});
