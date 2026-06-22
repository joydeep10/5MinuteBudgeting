import { describe, expect, it } from "vitest";

import {
  confirmIncomeReceived,
  createBudgetPlan,
  logSpending,
  markCommitmentPaid,
  recordBalanceSnapshot,
  recordSavingsContribution,
} from "../src/application";
import type { Money } from "../src/domain";

const money = (minorUnits: number): Money => minorUnits;

const testServices = () => {
  let nextId = 0;

  return {
    generateId: (prefix: string) => `${prefix}_${++nextId}`,
    now: () => "2026-06-22T10:00:00.000Z",
  };
};

describe("application BudgetPlan use cases", () => {
  it("creates a BudgetPlan with injected IDs, timestamps, categories, and an opening balance snapshot", () => {
    const plan = createBudgetPlan(
      {
        mode: "general",
        currency: {
          code: "USD",
          decimalPlaces: 2,
          symbol: "$",
        },
        activePeriod: {
          startDate: "2026-06-22",
          endDate: "2026-07-21",
        },
        fixedBuffer: money(20_000),
        startingAvailableMoney: money(150_000),
        defaultCategories: [
          {
            name: "Groceries",
            kind: "flexible",
          },
        ],
      },
      testServices(),
    );

    expect(plan).toMatchObject({
      schemaVersion: 1,
      id: "budget_1",
      createdAt: "2026-06-22T10:00:00.000Z",
      updatedAt: "2026-06-22T10:00:00.000Z",
      mode: "general",
      fixedBuffer: 20_000,
      activePeriod: {
        startDate: "2026-06-22",
        endDate: "2026-07-21",
      },
    });
    expect(plan.plannedRecords.categories).toEqual([
      {
        id: "category_2",
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
        name: "Groceries",
        kind: "flexible",
        archived: false,
      },
    ]);
    expect(plan.balanceSnapshots).toEqual([
      {
        id: "balance-snapshot_3",
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
        date: "2026-06-22",
        amount: 150_000,
        note: "Opening balance",
      },
    ]);
  });

  it("records balance snapshots and spending immutably inside the active period", () => {
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
        startingAvailableMoney: money(100_000),
      },
      services,
    );

    const withSnapshot = recordBalanceSnapshot(
      plan,
      {
        date: "2026-06-10",
        amount: money(82_000),
        note: "Mid-period check-in",
      },
      services,
    );
    const withSpending = logSpending(
      withSnapshot,
      {
        date: "2026-06-11",
        amount: money(4_500),
        categoryId: "category_groceries",
        note: "Groceries",
      },
      services,
    );

    expect(plan.balanceSnapshots).toHaveLength(1);
    expect(plan.financialEvents).toHaveLength(0);
    expect(withSnapshot).not.toBe(plan);
    expect(withSpending).not.toBe(withSnapshot);
    expect(withSnapshot.balanceSnapshots.at(-1)).toEqual({
      id: "balance-snapshot_3",
      createdAt: "2026-06-22T10:00:00.000Z",
      updatedAt: "2026-06-22T10:00:00.000Z",
      date: "2026-06-10",
      amount: 82_000,
      note: "Mid-period check-in",
    });
    expect(withSpending.financialEvents).toEqual([
      {
        id: "financial-event_4",
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
        date: "2026-06-11",
        kind: "spending",
        amount: 4_500,
        categoryId: "category_groceries",
        note: "Groceries",
      },
    ]);
    expect(() =>
      logSpending(
        withSpending,
        {
          date: "2026-07-01",
          amount: money(1_000),
        },
        services,
      ),
    ).toThrow(/active period/);
  });

  it("creates initial templates and records commitment, income, and savings events", () => {
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
        initialIncomeTemplates: [
          {
            name: "Paycheck",
            amount: money(120_000),
            active: true,
            startsOn: "2026-06-15",
            recurrence: {
              frequency: "biweekly",
              interval: 1,
              anchorDate: "2026-06-15",
            },
            includeInProjection: true,
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
          },
        ],
      },
      services,
    );

    expect(plan.plannedRecords.incomeTemplates[0]?.id).toBe("income-template_2");
    expect(plan.plannedRecords.commitmentTemplates[0]?.id).toBe(
      "commitment-template_3",
    );
    expect(plan.plannedRecords.savingsGoals[0]?.id).toBe("savings-goal_4");

    const withPartialPayment = markCommitmentPaid(
      plan,
      {
        date: "2026-06-12",
        commitmentTemplateId: "commitment-template_3",
        occurrenceDate: "2026-06-10",
        amount: money(10_000),
      },
      services,
    );
    const withRemainingPayment = markCommitmentPaid(
      withPartialPayment,
      {
        date: "2026-06-13",
        commitmentTemplateId: "commitment-template_3",
        occurrenceDate: "2026-06-10",
      },
      services,
    );
    const withIncome = confirmIncomeReceived(
      withRemainingPayment,
      {
        date: "2026-06-15",
        amount: money(120_000),
        incomeTemplateId: "income-template_2",
      },
      services,
    );
    const withSavings = recordSavingsContribution(
      withIncome,
      {
        date: "2026-06-16",
        amount: money(15_000),
        savingsGoalId: "savings-goal_4",
      },
      services,
    );

    expect(withSavings.financialEvents).toEqual([
      expect.objectContaining({
        id: "financial-event_6",
        kind: "commitment-payment",
        amount: 10_000,
        commitmentTemplateId: "commitment-template_3",
        occurrenceDate: "2026-06-10",
      }),
      expect.objectContaining({
        id: "financial-event_7",
        kind: "commitment-payment",
        amount: 20_000,
        commitmentTemplateId: "commitment-template_3",
        occurrenceDate: "2026-06-10",
      }),
      expect.objectContaining({
        id: "financial-event_8",
        kind: "income-received",
        amount: 120_000,
        incomeTemplateId: "income-template_2",
      }),
      expect.objectContaining({
        id: "financial-event_9",
        kind: "savings-contribution",
        amount: 15_000,
        savingsGoalId: "savings-goal_4",
      }),
    ]);
    expect(plan.financialEvents).toHaveLength(0);
  });
});
