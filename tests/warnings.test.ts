import { describe, expect, it } from "vitest";

import { budgetPlanSchemaVersion, calculateSafeToSpend } from "../src/domain";
import type {
  BalanceSnapshot,
  BudgetPlan,
  Category,
  CommitmentTemplate,
  FinancialEventRecord,
  FlexibleCategoryGuidance,
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
    fixedBuffer?: Money;
    balanceSnapshots?: readonly BalanceSnapshot[];
    financialEvents?: readonly FinancialEventRecord[];
    categories?: readonly Category[];
    flexibleCategoryGuidance?: readonly FlexibleCategoryGuidance[];
    commitmentTemplates?: readonly CommitmentTemplate[];
    savingsGoals?: readonly SavingsGoal[];
  } = {},
): BudgetPlan => ({
  schemaVersion: budgetPlanSchemaVersion,
  id: "budget_warnings",
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
    categories: overrides.categories ?? [],
    incomeTemplates: [],
    commitmentTemplates: overrides.commitmentTemplates ?? [],
    savingsGoals: overrides.savingsGoals ?? [],
    flexibleCategoryGuidance: overrides.flexibleCategoryGuidance ?? [],
  },
  balanceSnapshots: overrides.balanceSnapshots ?? [],
  financialEvents: overrides.financialEvents ?? [],
});

describe("structured budget warnings", () => {
  it("reports a critical shortfall warning with stable identity and metadata", () => {
    const result = calculateSafeToSpend({
      plan: plan({
        fixedBuffer: money(5_000),
        balanceSnapshots: [
          snapshot({
            id: "snapshot_opening",
            amount: money(20_000),
          }),
        ],
        commitmentTemplates: [
          commitment({
            id: "bill_rent",
            amount: money(30_000),
            startsOn: "2026-06-10",
          }),
        ],
      }),
      today: "2026-06-10",
    });

    expect(result.confirmed.safeThisPeriod).toBe(0);
    expect(result.warnings).toEqual([
      {
        id: "critical-shortfall:budget_warnings",
        severity: "critical",
        code: "critical-shortfall",
        metadata: {
          rawSafePool: -15_000,
          shortfallAmount: 15_000,
        },
      },
    ]);
  });

  it("reports overdue commitments as critical and due-today commitments as warning-level while keeping them counted", () => {
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
            id: "bill_power",
            amount: money(15_000),
            startsOn: "2026-06-09",
          }),
          commitment({
            id: "debt_card",
            kind: "debt",
            amount: money(25_000),
            startsOn: "2026-06-10",
          }),
        ],
      }),
      today: "2026-06-10",
    });

    expect(result.breakdown.unpaidCommitments).toBe(40_000);
    expect(result.warnings).toEqual([
      {
        id: "overdue-commitment:bill_power:2026-06-09",
        severity: "critical",
        code: "overdue-commitment",
        metadata: {
          commitmentTemplateId: "bill_power",
          occurrenceDate: "2026-06-09",
          kind: "bill",
          remainingUnpaidAmount: 15_000,
        },
      },
      {
        id: "commitment-due-today:debt_card:2026-06-10",
        severity: "warning",
        code: "commitment-due-today",
        metadata: {
          commitmentTemplateId: "debt_card",
          occurrenceDate: "2026-06-10",
          kind: "debt",
          remainingUnpaidAmount: 25_000,
        },
      },
    ]);
  });

  it("reports overdue incomplete savings goals as warning-level alerts", () => {
    const result = calculateSafeToSpend({
      plan: plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_opening",
            amount: money(100_000),
          }),
        ],
        savingsGoals: [
          goal({
            id: "goal_registration",
            name: "Registration",
            targetAmount: money(50_000),
            currentAmount: money(20_000),
            targetDate: "2026-05-31",
            protected: true,
          }),
        ],
      }),
      today: "2026-06-10",
    });

    expect(result.warnings).toEqual([
      {
        id: "overdue-savings-goal:goal_registration",
        severity: "warning",
        code: "overdue-savings-goal",
        metadata: {
          savingsGoalId: "goal_registration",
          remainingAmount: 30_000,
          targetDate: "2026-05-31",
        },
      },
    ]);
  });

  it("reports flexible category overages as guidance without changing the safe pool", () => {
    const dining = category({
      id: "category_dining",
      name: "Dining out",
    });

    const result = calculateSafeToSpend({
      plan: plan({
        balanceSnapshots: [
          snapshot({
            id: "snapshot_opening",
            amount: money(100_000),
          }),
        ],
        categories: [dining],
        flexibleCategoryGuidance: [
          guidance({
            id: "guidance_dining",
            categoryId: dining.id,
            periodLimit: money(10_000),
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

    expect(result.confirmed.rawSafePool).toBe(85_000);
    expect(result.warnings).toEqual([
      {
        id: "category-overage:category_dining",
        severity: "guidance",
        code: "category-overage",
        metadata: {
          categoryId: "category_dining",
          spentAmount: 15_000,
          periodLimit: 10_000,
          overageAmount: 5_000,
        },
      },
    ]);
  });
});
