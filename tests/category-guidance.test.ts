import { describe, expect, it } from "vitest";

import {
  budgetPlanSchemaVersion,
  calculateCategorySummaries,
} from "../src/domain";
import type {
  BudgetPlan,
  Category,
  FinancialEventRecord,
  FlexibleCategoryGuidance,
  Money,
} from "../src/domain";

const money = (minorUnits: number): Money => minorUnits;

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

const spending = (
  overrides: Partial<FinancialEventRecord> & Pick<FinancialEventRecord, "id">,
): FinancialEventRecord => ({
  id: overrides.id,
  createdAt: overrides.createdAt ?? "2026-06-01T08:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-06-01T08:00:00.000Z",
  date: overrides.date ?? "2026-06-01",
  kind: "spending",
  amount: overrides.amount ?? money(0),
  categoryId: overrides.categoryId,
  note: overrides.note,
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

const plan = (
  overrides: {
    categories?: readonly Category[];
    flexibleCategoryGuidance?: readonly FlexibleCategoryGuidance[];
    financialEvents?: readonly FinancialEventRecord[];
  } = {},
): BudgetPlan => ({
  schemaVersion: budgetPlanSchemaVersion,
  id: "budget_categories",
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
    categories: overrides.categories ?? [],
    incomeTemplates: [],
    commitmentTemplates: [],
    savingsGoals: [],
    flexibleCategoryGuidance: overrides.flexibleCategoryGuidance ?? [],
  },
  balanceSnapshots: [],
  financialEvents: overrides.financialEvents ?? [],
});

describe("category guidance summaries", () => {
  it("supports default-style and custom categories from the plan registry", () => {
    const groceries = category({
      id: "category_groceries",
      name: "Groceries",
      kind: "flexible",
    });
    const hobbies = category({
      id: "category_hobbies_custom",
      name: "Hobbies",
      kind: "custom",
    });

    const summaries = calculateCategorySummaries(
      plan({
        categories: [groceries, hobbies],
        financialEvents: [
          spending({
            id: "spend_groceries",
            amount: money(8_000),
            categoryId: groceries.id,
          }),
          spending({
            id: "spend_hobbies",
            amount: money(6_000),
            categoryId: hobbies.id,
          }),
        ],
      }),
    );

    expect(
      summaries.map(({ categoryId, categoryKind, spentAmount }) => ({
        categoryId,
        categoryKind,
        spentAmount,
      })),
    ).toEqual([
      {
        categoryId: "category_groceries",
        categoryKind: "flexible",
        spentAmount: 8_000,
      },
      {
        categoryId: "category_hobbies_custom",
        categoryKind: "custom",
        spentAmount: 6_000,
      },
    ]);
  });

  it("summarizes active-period spending by category identity", () => {
    const groceries = category({
      id: "category_groceries",
      name: "Groceries",
    });
    const transport = category({
      id: "category_transport",
      name: "Transport",
    });

    const summaries = calculateCategorySummaries(
      plan({
        categories: [groceries, transport],
        financialEvents: [
          spending({
            id: "spend_groceries_one",
            amount: money(8_000),
            categoryId: groceries.id,
          }),
          spending({
            id: "spend_transport",
            amount: money(2_500),
            categoryId: transport.id,
          }),
          spending({
            id: "spend_groceries_two",
            amount: money(4_000),
            categoryId: groceries.id,
          }),
          spending({
            id: "spend_next_period",
            date: "2026-07-01",
            amount: money(9_999),
            categoryId: groceries.id,
          }),
        ],
      }),
    );

    expect(
      summaries.map(({ categoryId, categoryName, spentAmount }) => ({
        categoryId,
        categoryName,
        spentAmount,
      })),
    ).toEqual([
      {
        categoryId: "category_groceries",
        categoryName: "Groceries",
        spentAmount: 12_000,
      },
      {
        categoryId: "category_transport",
        categoryName: "Transport",
        spentAmount: 2_500,
      },
    ]);
  });

  it("reports flexible guidance limits and overages for later warnings", () => {
    const dining = category({
      id: "category_dining",
      name: "Dining out",
    });

    const summaries = calculateCategorySummaries(
      plan({
        categories: [dining],
        flexibleCategoryGuidance: [
          guidance({
            id: "guidance_dining",
            categoryId: dining.id,
            periodLimit: money(15_000),
          }),
        ],
        financialEvents: [
          spending({
            id: "spend_lunches",
            amount: money(12_000),
            categoryId: dining.id,
          }),
          spending({
            id: "spend_dinner",
            amount: money(7_500),
            categoryId: dining.id,
          }),
        ],
      }),
    );

    expect(summaries).toEqual([
      expect.objectContaining({
        categoryId: "category_dining",
        spentAmount: 19_500,
        periodLimit: 15_000,
        remainingGuidanceAmount: 0,
        overageAmount: 4_500,
      }),
    ]);
  });

  it("includes guided categories with no spending as chart-ready zero-value summaries", () => {
    const hobbies = category({
      id: "category_hobbies_custom",
      name: "Hobbies",
      kind: "custom",
    });

    const summaries = calculateCategorySummaries(
      plan({
        categories: [hobbies],
        flexibleCategoryGuidance: [
          guidance({
            id: "guidance_hobbies",
            categoryId: hobbies.id,
            periodLimit: money(10_000),
            reserved: true,
          }),
        ],
      }),
    );

    expect(summaries).toEqual([
      expect.objectContaining({
        categoryId: "category_hobbies_custom",
        categoryName: "Hobbies",
        categoryKind: "custom",
        spentAmount: 0,
        periodLimit: 10_000,
        remainingGuidanceAmount: 10_000,
        overageAmount: 0,
        reserved: true,
        chartValue: 0,
      }),
    ]);
  });
});
