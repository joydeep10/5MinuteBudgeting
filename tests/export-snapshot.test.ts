import { describe, expect, it } from "vitest";

import {
  budgetPlanSchemaVersion,
  buildExportSnapshot,
  calculateCategorySummaries,
  calculateSafeToSpend,
  calculateSavingsGoalAllocations,
  generateCommitmentOccurrences,
} from "../src/domain";
import {
  createBudgetSnapshotPdfExport,
  createBudgetSnapshotWorkbookExport,
} from "../src/infrastructure";
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
    categories?: readonly Category[];
    flexibleCategoryGuidance?: readonly FlexibleCategoryGuidance[];
    commitmentTemplates?: readonly CommitmentTemplate[];
    savingsGoals?: readonly SavingsGoal[];
    balanceSnapshots?: readonly BalanceSnapshot[];
    financialEvents?: readonly FinancialEventRecord[];
  } = {},
): BudgetPlan => ({
  schemaVersion: budgetPlanSchemaVersion,
  id: "budget_export",
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
  fixedBuffer: money(5_000),
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

describe("export snapshot builder", () => {
  it("uses the supplied calculator result for export metrics, health, warnings, period, and currency", () => {
    const dining = category({
      id: "category_dining",
      name: "Dining out",
    });
    const budgetPlan = plan({
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
      commitmentTemplates: [
        commitment({
          id: "bill_rent",
          amount: money(30_000),
          startsOn: "2026-06-10",
        }),
      ],
      savingsGoals: [
        goal({
          id: "goal_emergency",
          targetAmount: money(100_000),
          currentAmount: money(40_000),
          targetDate: "2026-08-30",
          periodContributionOverride: money(15_000),
        }),
      ],
      financialEvents: [
        event({
          id: "spend_dining",
          date: "2026-06-10",
          amount: money(12_000),
          categoryId: dining.id,
        }),
      ],
    });
    const calculation = calculateSafeToSpend({
      plan: budgetPlan,
      today: "2026-06-10",
    });

    const snapshotResult = buildExportSnapshot({
      plan: budgetPlan,
      today: "2026-06-10",
      calculation,
      commitmentOccurrences: generateCommitmentOccurrences({
        commitments: budgetPlan.plannedRecords.commitmentTemplates,
        period: budgetPlan.activePeriod,
        today: "2026-06-10",
        financialEvents: budgetPlan.financialEvents,
        amountOverrides: [],
      }),
      categorySummaries: calculateCategorySummaries(budgetPlan),
      savingsGoalAllocations: calculateSavingsGoalAllocations(budgetPlan),
    });

    expect(snapshotResult.metrics.confirmed).toBe(calculation.confirmed);
    expect(snapshotResult.metrics.projected).toBe(calculation.projected);
    expect(snapshotResult.metrics.health).toBe(calculation.health);
    expect(snapshotResult.metrics.warnings).toBe(calculation.warnings);
    expect(snapshotResult.activePeriod).toEqual(budgetPlan.activePeriod);
    expect(snapshotResult.currency).toEqual(budgetPlan.currency);
    expect(snapshotResult.summary).toEqual(
      expect.objectContaining({
        effectiveAvailableMoney: 88_000,
        unpaidCommitments: 30_000,
        protectedSavings: 15_000,
        fixedBuffer: 5_000,
      }),
    );
  });

  it("includes report-ready summaries, ledger rows, and generic chart-ready arrays", () => {
    const dining = category({
      id: "category_dining",
      name: "Dining out",
    });
    const budgetPlan = plan({
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
      commitmentTemplates: [
        commitment({
          id: "bill_rent",
          name: "Rent",
          amount: money(30_000),
          startsOn: "2026-06-10",
        }),
      ],
      savingsGoals: [
        goal({
          id: "goal_emergency",
          name: "Emergency fund",
          targetAmount: money(100_000),
          currentAmount: money(40_000),
          targetDate: "2026-08-30",
          periodContributionOverride: money(15_000),
        }),
      ],
      financialEvents: [
        event({
          id: "spend_dining",
          date: "2026-06-10",
          amount: money(12_000),
          categoryId: dining.id,
          note: "Dinner",
        }),
      ],
    });
    const today = "2026-06-10";
    const calculation = calculateSafeToSpend({
      plan: budgetPlan,
      today,
    });
    const commitmentOccurrences = generateCommitmentOccurrences({
      commitments: budgetPlan.plannedRecords.commitmentTemplates,
      period: budgetPlan.activePeriod,
      today,
      financialEvents: budgetPlan.financialEvents,
      amountOverrides: [],
    });
    const categorySummaries = calculateCategorySummaries(budgetPlan);
    const savingsGoalAllocations = calculateSavingsGoalAllocations(budgetPlan);

    const snapshotResult = buildExportSnapshot({
      plan: budgetPlan,
      today,
      calculation,
      commitmentOccurrences,
      categorySummaries,
      savingsGoalAllocations,
    });

    expect(snapshotResult.report.commitments).toEqual([
      expect.objectContaining({
        templateId: "bill_rent",
        name: "Rent",
        date: "2026-06-10",
        amount: 30_000,
        remainingUnpaidAmount: 30_000,
      }),
    ]);
    expect(snapshotResult.report.spendingSummaries).toEqual([
      expect.objectContaining({
        categoryId: "category_dining",
        categoryName: "Dining out",
        spentAmount: 12_000,
        overageAmount: 2_000,
      }),
    ]);
    expect(snapshotResult.report.savingsSummaries).toEqual([
      expect.objectContaining({
        goalId: "goal_emergency",
        name: "Emergency fund",
        progressAmount: 40_000,
        remainingProtectedDeduction: 15_000,
      }),
    ]);
    expect(snapshotResult.report.ledgerRows).toEqual([
      expect.objectContaining({
        id: "spend_dining",
        date: "2026-06-10",
        rowType: "financial-event",
        amount: -12_000,
      }),
      expect.objectContaining({
        id: "bill_rent:2026-06-10",
        date: "2026-06-10",
        rowType: "commitment-occurrence",
        amount: -30_000,
      }),
    ]);
    expect(snapshotResult.charts.categorySpending).toEqual([
      {
        categoryId: "category_dining",
        label: "Dining out",
        value: 12_000,
        limit: 10_000,
        overageAmount: 2_000,
      },
    ]);
    expect(snapshotResult.charts.commitmentsByDate).toEqual([
      {
        date: "2026-06-10",
        label: "Rent",
        value: 30_000,
        remainingUnpaidAmount: 30_000,
      },
    ]);
    expect(snapshotResult.charts.savingsProgress).toEqual([
      {
        goalId: "goal_emergency",
        label: "Emergency fund",
        currentAmount: 40_000,
        targetAmount: 100_000,
        progressAmount: 40_000,
        remainingAmount: 60_000,
      },
    ]);
    expect(snapshotResult.charts.budgetRunway).toEqual([
      {
        label: "today",
        value: calculation.confirmed.safeToday,
      },
      {
        label: "this-week",
        value: calculation.confirmed.safeThisWeek,
      },
      {
        label: "this-period",
        value: calculation.confirmed.safeThisPeriod,
      },
    ]);
    expect(snapshotResult.charts.healthContext).toEqual([
      {
        status: calculation.health,
        rawSafePool: calculation.confirmed.rawSafePool,
        shortfallAmount: 0,
      },
    ]);
  });

  it("generates PDF and editable workbook files from the supplied export snapshot", () => {
    const dining = category({
      id: "category_dining",
      name: "Dining out",
    });
    const budgetPlan = plan({
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
          amount: money(12_000),
          categoryId: dining.id,
          note: "Dinner",
        }),
      ],
    });
    const calculation = calculateSafeToSpend({
      plan: budgetPlan,
      today: "2026-06-10",
    });
    const snapshotResult = buildExportSnapshot({
      plan: budgetPlan,
      today: "2026-06-10",
      calculation,
      commitmentOccurrences: [],
      categorySummaries: calculateCategorySummaries(budgetPlan),
      savingsGoalAllocations: [],
    });

    const pdf = createBudgetSnapshotPdfExport({
      snapshot: snapshotResult,
      generatedAt: "2026-06-10T08:00:00.000Z",
    });
    const workbook = createBudgetSnapshotWorkbookExport({
      snapshot: snapshotResult,
      generatedAt: "2026-06-10T08:00:00.000Z",
    });

    expect(pdf.fileName).toBe("5-minute-budgeting-snapshot-2026-06-10.pdf");
    expect(pdf.mimeType).toBe("application/pdf");
    expect(pdf.contents).toContain("Safe to spend today");
    expect(pdf.contents).toContain("USD 45.23");
    expect(pdf.contents).toContain("Dining out");
    expect(workbook.fileName).toBe("5-minute-budgeting-snapshot-2026-06-10.xls");
    expect(workbook.mimeType).toBe("application/vnd.ms-excel");
    expect(workbook.contents).toContain("<Workbook");
    expect(workbook.contents).toContain("Summary");
    expect(workbook.contents).toContain("Ledger");
    expect(workbook.contents).toContain("USD 45.23");
    expect(workbook.contents).toContain("Dinner");
  });
});
