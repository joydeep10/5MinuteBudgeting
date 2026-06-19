import { describe, expect, it } from "vitest";

import {
  budgetPlanSchemaVersion,
  calculateEffectiveAvailableMoney,
  calculateSavingsGoalAllocations,
} from "../src/domain";
import type {
  BalanceSnapshot,
  BudgetPlan,
  FinancialEventRecord,
  Money,
  SavingsGoal,
} from "../src/domain";

const money = (minorUnits: number): Money => minorUnits;

const goal = (
  overrides: Partial<SavingsGoal> & Pick<SavingsGoal, "id">,
): SavingsGoal => ({
  id: overrides.id,
  createdAt: overrides.createdAt ?? "2026-06-01T08:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-06-01T08:00:00.000Z",
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
  kind: overrides.kind ?? "savings-contribution",
  amount: overrides.amount ?? money(0),
  categoryId: overrides.categoryId,
  incomeTemplateId: overrides.incomeTemplateId,
  commitmentTemplateId: overrides.commitmentTemplateId,
  occurrenceDate: overrides.occurrenceDate,
  savingsGoalId: overrides.savingsGoalId,
  note: overrides.note,
});

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

const plan = (
  overrides: {
    savingsGoals?: readonly SavingsGoal[];
    balanceSnapshots?: readonly BalanceSnapshot[];
    financialEvents?: readonly FinancialEventRecord[];
  } = {},
): BudgetPlan => ({
  schemaVersion: budgetPlanSchemaVersion,
  id: "budget_savings",
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
    savingsGoals: overrides.savingsGoals ?? [],
    flexibleCategoryGuidance: [],
  },
  balanceSnapshots: overrides.balanceSnapshots ?? [],
  financialEvents: overrides.financialEvents ?? [],
});

describe("savings goals", () => {
  it("calculates suggested and remaining protected savings deduction for an active protected goal", () => {
    const allocations = calculateSavingsGoalAllocations(
      plan({
        savingsGoals: [
          goal({
            id: "goal_emergency",
            targetAmount: money(100_000),
            currentAmount: money(40_000),
            targetDate: "2026-08-30",
            status: "active",
            protected: true,
          }),
        ],
      }),
    );

    expect(allocations).toEqual([
      expect.objectContaining({
        goalId: "goal_emergency",
        suggestedPeriodContribution: 20_000,
        plannedPeriodContribution: 20_000,
        contributedThisPeriod: 0,
        remainingProtectedDeduction: 20_000,
      }),
    ]);
  });

  it("uses one remaining period for overdue incomplete goals and flags them for warnings", () => {
    const allocations = calculateSavingsGoalAllocations(
      plan({
        savingsGoals: [
          goal({
            id: "goal_registration",
            targetAmount: money(100_000),
            currentAmount: money(40_000),
            targetDate: "2026-05-31",
            status: "active",
            protected: true,
          }),
        ],
      }),
    );

    expect(allocations).toEqual([
      expect.objectContaining({
        goalId: "goal_registration",
        suggestedPeriodContribution: 60_000,
        plannedPeriodContribution: 60_000,
        remainingProtectedDeduction: 60_000,
        overdueIncomplete: true,
      }),
    ]);
  });

  it("keeps unprotected goals out of protected deductions and ignores paused goals", () => {
    const allocations = calculateSavingsGoalAllocations(
      plan({
        savingsGoals: [
          goal({
            id: "goal_trip",
            targetAmount: money(100_000),
            currentAmount: money(40_000),
            targetDate: "2026-08-30",
            status: "active",
            protected: false,
          }),
          goal({
            id: "goal_furniture",
            targetAmount: money(90_000),
            currentAmount: money(30_000),
            targetDate: "2026-08-30",
            status: "paused",
            protected: true,
          }),
        ],
      }),
    );

    expect(
      allocations.map(
        ({
          goalId,
          suggestedPeriodContribution,
          plannedPeriodContribution,
          remainingProtectedDeduction,
        }) => ({
          goalId,
          suggestedPeriodContribution,
          plannedPeriodContribution,
          remainingProtectedDeduction,
        }),
      ),
    ).toEqual([
      {
        goalId: "goal_trip",
        suggestedPeriodContribution: 20_000,
        plannedPeriodContribution: 20_000,
        remainingProtectedDeduction: 0,
      },
      {
        goalId: "goal_furniture",
        suggestedPeriodContribution: 0,
        plannedPeriodContribution: 0,
        remainingProtectedDeduction: 0,
      },
    ]);
  });

  it("uses a user override for the planned contribution without letting priority affect the suggestion", () => {
    const allocations = calculateSavingsGoalAllocations(
      plan({
        savingsGoals: [
          goal({
            id: "goal_emergency",
            targetAmount: money(100_000),
            currentAmount: money(40_000),
            targetDate: "2026-08-30",
            status: "active",
            protected: true,
            priority: 99,
            periodContributionOverride: money(12_345),
          }),
        ],
      }),
    );

    expect(allocations).toEqual([
      expect.objectContaining({
        goalId: "goal_emergency",
        priority: 99,
        suggestedPeriodContribution: 20_000,
        plannedPeriodContribution: 12_345,
        remainingProtectedDeduction: 12_345,
      }),
    ]);
  });

  it("applies active-period contributions to progress, protected deduction, and effective available money", () => {
    const budgetPlan = plan({
      savingsGoals: [
        goal({
          id: "goal_emergency",
          targetAmount: money(100_000),
          currentAmount: money(40_000),
          targetDate: "2026-08-30",
          status: "active",
          protected: true,
        }),
      ],
      balanceSnapshots: [
        snapshot({
          id: "snapshot_opening",
          date: "2026-06-01",
          amount: money(200_000),
        }),
      ],
      financialEvents: [
        event({
          id: "emergency_contribution",
          date: "2026-06-15",
          kind: "savings-contribution",
          amount: money(25_000),
          savingsGoalId: "goal_emergency",
        }),
      ],
    });

    expect(calculateSavingsGoalAllocations(budgetPlan)).toEqual([
      expect.objectContaining({
        goalId: "goal_emergency",
        progressAmount: 65_000,
        remainingAmount: 35_000,
        suggestedPeriodContribution: 20_000,
        plannedPeriodContribution: 20_000,
        contributedThisPeriod: 25_000,
        remainingProtectedDeduction: 0,
      }),
    ]);
    expect(calculateEffectiveAvailableMoney(budgetPlan)).toBe(175_000);
  });

  it("keeps completed goals out of suggestions, deductions, and overdue warnings", () => {
    const allocations = calculateSavingsGoalAllocations(
      plan({
        savingsGoals: [
          goal({
            id: "goal_completed",
            targetAmount: money(100_000),
            currentAmount: money(100_000),
            targetDate: "2026-05-31",
            status: "completed",
            protected: true,
          }),
        ],
      }),
    );

    expect(allocations).toEqual([
      expect.objectContaining({
        goalId: "goal_completed",
        progressAmount: 100_000,
        remainingAmount: 0,
        suggestedPeriodContribution: 0,
        plannedPeriodContribution: 0,
        remainingProtectedDeduction: 0,
        overdueIncomplete: false,
      }),
    ]);
  });
});
