import { describe, expect, it } from "vitest";

import {
  createBudgetPlan,
  logSpending,
  markCommitmentPaid,
  recordSavingsContribution,
  rollBudgetPlanPeriodForward,
  suggestNextActivePeriod,
} from "../src/application";
import { calculateSafeToSpend } from "../src/domain";
import type { Money } from "../src/domain";

const money = (minorUnits: number): Money => minorUnits;

const testServices = () => {
  let nextId = 0;

  return {
    generateId: (prefix: string) => `${prefix}_${++nextId}`,
    now: () => "2026-06-22T10:00:00.000Z",
  };
};

describe("application roll-forward use case", () => {
  it("snapshots the previous period and starts the next period from a user-confirmed balance", () => {
    const services = testServices();
    const plan = createBudgetPlan(
      {
        mode: "fixed-income",
        currency: {
          code: "USD",
          decimalPlaces: 2,
        },
        activePeriod: {
          startDate: "2026-06-01",
          endDate: "2026-06-30",
        },
        fixedBuffer: money(10_000),
        startingAvailableMoney: money(200_000),
        defaultCategories: [
          {
            name: "Groceries",
            kind: "flexible",
          },
        ],
        initialCommitmentTemplates: [
          {
            name: "Rent",
            kind: "bill",
            amount: money(30_000),
            active: true,
            startsOn: "2026-06-10",
            recurrence: {
              frequency: "one-time",
              interval: 1,
              anchorDate: "2026-06-10",
            },
          },
        ],
        initialSavingsGoals: [
          {
            name: "Emergency fund",
            targetAmount: money(100_000),
            currentAmount: money(25_000),
            targetDate: "2026-08-30",
            status: "active",
            protected: true,
            periodContributionOverride: money(15_000),
          },
        ],
      },
      services,
    );
    const withSpending = logSpending(
      plan,
      {
        date: "2026-06-05",
        amount: money(5_000),
        categoryId: "category_2",
      },
      services,
    );
    const withPayment = markCommitmentPaid(
      withSpending,
      {
        date: "2026-06-10",
        commitmentTemplateId: "commitment-template_3",
        occurrenceDate: "2026-06-10",
      },
      services,
    );
    const readyToRoll = recordSavingsContribution(
      withPayment,
      {
        date: "2026-06-15",
        amount: money(15_000),
        savingsGoalId: "savings-goal_4",
      },
      services,
    );

    expect(suggestNextActivePeriod(plan)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-30",
    });

    const rolled = rollBudgetPlanPeriodForward(
      readyToRoll,
      {
        newActivePeriod: {
          startDate: "2026-07-01",
          endDate: "2026-07-31",
        },
        confirmedAvailableMoney: money(140_000),
      },
      services,
    );

    expect(readyToRoll.periodSnapshots).toBeUndefined();
    expect(rolled.periodSnapshots).toEqual([
      {
        id: "period-snapshot_9",
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
        period: {
          startDate: "2026-06-01",
          endDate: "2026-06-30",
        },
        startingAvailableMoney: 200_000,
        endingEffectiveAvailableMoney: 150_000,
        totalSpending: 5_000,
        totalCommitmentsPaid: 30_000,
        totalSavingsContributions: 15_000,
        finalHealthStatus: "safe",
      },
    ]);
    expect(rolled.activePeriod).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
    expect(rolled.balanceSnapshots.at(-1)).toEqual({
      id: "balance-snapshot_10",
      createdAt: "2026-06-22T10:00:00.000Z",
      updatedAt: "2026-06-22T10:00:00.000Z",
      date: "2026-07-01",
      amount: 140_000,
      note: "Roll-forward opening balance",
    });
    expect(rolled.financialEvents).toHaveLength(3);
    expect(rolled.plannedRecords.categories[0]?.id).toBe("category_2");
    expect(rolled.plannedRecords.commitmentTemplates[0]?.id).toBe(
      "commitment-template_3",
    );
    expect(rolled.plannedRecords.savingsGoals[0]).toEqual(
      expect.objectContaining({
        id: "savings-goal_4",
        currentAmount: 40_000,
      }),
    );
    expect(
      calculateSafeToSpend({
        plan: rolled,
        today: "2026-07-01",
      }).breakdown.effectiveAvailableMoney,
    ).toBe(140_000);
  });

  it("requires a valid user-confirmed balance and a valid next period when rolling forward", () => {
    const services = testServices();
    const plan = createBudgetPlan(
      {
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
        startingAvailableMoney: money(50_000),
      },
      services,
    );

    expect(() =>
      rollBudgetPlanPeriodForward(
        plan,
        {
          newActivePeriod: {
            startDate: "2026-07-01",
            endDate: "2026-06-30",
          },
          confirmedAvailableMoney: money(50_000),
        },
        services,
      ),
    ).toThrow(/end on or after/);
    expect(() =>
      rollBudgetPlanPeriodForward(
        plan,
        {
          newActivePeriod: {
            startDate: "2026-07-01",
            endDate: "2026-07-31",
          },
          confirmedAvailableMoney: Number.NaN,
        },
        services,
      ),
    ).toThrow(/confirmed available money/);
  });
});
