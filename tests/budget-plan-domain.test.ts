import { describe, expect, it } from "vitest";

import { budgetPlanSchemaVersion } from "../src/domain";
import type {
  BalanceSnapshot,
  BudgetPlan,
  Category,
  CommitmentTemplate,
  CurrencyMetadata,
  DateOnly,
  FinancialEventRecord,
  FlexibleCategoryGuidance,
  IncomeTemplate,
  Money,
  SavingsGoal,
  Timestamp,
} from "../src/domain";

const money = (minorUnits: number): Money => minorUnits;
const dateOnly = (value: string): DateOnly => value;
const timestamp = (value: string): Timestamp => value;

describe("BudgetPlan domain model", () => {
  it("can represent a storage-ready plan fixture with one budget-level currency", () => {
    const usd: CurrencyMetadata = {
      code: "USD",
      decimalPlaces: 2,
      symbol: "$",
    };

    const groceries: Category = {
      id: "category_groceries",
      createdAt: timestamp("2026-06-19T08:00:00.000Z"),
      updatedAt: timestamp("2026-06-19T08:00:00.000Z"),
      name: "Groceries",
      kind: "flexible",
      archived: false,
    };

    const income: IncomeTemplate = {
      id: "income_salary",
      createdAt: timestamp("2026-06-19T08:01:00.000Z"),
      updatedAt: timestamp("2026-06-19T08:01:00.000Z"),
      name: "Salary",
      amount: money(250_000),
      active: true,
      startsOn: dateOnly("2026-06-20"),
      recurrence: {
        frequency: "biweekly",
        interval: 1,
        anchorDate: dateOnly("2026-06-20"),
      },
      includeInProjection: true,
    };

    const rent: CommitmentTemplate = {
      id: "commitment_rent",
      createdAt: timestamp("2026-06-19T08:02:00.000Z"),
      updatedAt: timestamp("2026-06-19T08:02:00.000Z"),
      name: "Rent",
      kind: "bill",
      amount: money(120_000),
      active: true,
      startsOn: dateOnly("2026-07-01"),
      recurrence: {
        frequency: "monthly",
        interval: 1,
        anchorDate: dateOnly("2026-07-01"),
        monthly: {
          dayOfMonth: 1,
          missingDayBehavior: "last-valid-day",
        },
      },
    };

    const emergencyFund: SavingsGoal = {
      id: "goal_emergency",
      createdAt: timestamp("2026-06-19T08:03:00.000Z"),
      updatedAt: timestamp("2026-06-19T08:03:00.000Z"),
      name: "Emergency fund",
      targetAmount: money(500_000),
      currentAmount: money(75_000),
      targetDate: dateOnly("2026-12-31"),
      status: "active",
      protected: true,
      priority: 1,
    };

    const groceryGuidance: FlexibleCategoryGuidance = {
      id: "guidance_groceries",
      createdAt: timestamp("2026-06-19T08:04:00.000Z"),
      updatedAt: timestamp("2026-06-19T08:04:00.000Z"),
      categoryId: groceries.id,
      periodLimit: money(40_000),
      reserved: false,
    };

    const openingSnapshot: BalanceSnapshot = {
      id: "snapshot_opening",
      createdAt: timestamp("2026-06-19T08:05:00.000Z"),
      updatedAt: timestamp("2026-06-19T08:05:00.000Z"),
      date: dateOnly("2026-06-19"),
      amount: money(180_000),
      note: "Starting balance",
    };

    const grocerySpend: FinancialEventRecord = {
      id: "event_grocery_spend",
      createdAt: timestamp("2026-06-19T08:06:00.000Z"),
      updatedAt: timestamp("2026-06-19T08:06:00.000Z"),
      date: dateOnly("2026-06-19"),
      kind: "spending",
      amount: money(5_250),
      categoryId: groceries.id,
      note: "Weekly shop",
    };

    const plan: BudgetPlan = {
      schemaVersion: budgetPlanSchemaVersion,
      id: "budget_june",
      createdAt: timestamp("2026-06-19T08:00:00.000Z"),
      updatedAt: timestamp("2026-06-19T08:06:00.000Z"),
      mode: "fixed-income",
      currency: usd,
      activePeriod: {
        startDate: dateOnly("2026-06-19"),
        endDate: dateOnly("2026-07-18"),
      },
      fixedBuffer: money(20_000),
      plannedRecords: {
        categories: [groceries],
        incomeTemplates: [income],
        commitmentTemplates: [rent],
        savingsGoals: [emergencyFund],
        flexibleCategoryGuidance: [groceryGuidance],
      },
      balanceSnapshots: [openingSnapshot],
      financialEvents: [grocerySpend],
    };

    expect(plan.currency).toEqual(usd);
    expect(plan.schemaVersion).toBe(1);
    expect(plan.plannedRecords.commitmentTemplates[0]?.amount).toBe(120_000);
    expect(plan.financialEvents[0]?.kind).toBe("spending");
  });
});
