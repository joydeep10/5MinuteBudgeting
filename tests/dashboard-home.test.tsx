import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "../src/app/App";
import { budgetPlanSchemaVersion } from "../src/domain";
import type {
  BalanceSnapshot,
  BudgetPlan,
  Category,
  CommitmentTemplate,
  FinancialEventRecord,
  FlexibleCategoryGuidance,
  Money,
  PeriodSnapshot,
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

const event = (
  overrides: Partial<FinancialEventRecord> & Pick<FinancialEventRecord, "id">,
): FinancialEventRecord => ({
  id: overrides.id,
  createdAt: overrides.createdAt ?? "2026-06-10T08:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-06-10T08:00:00.000Z",
  date: overrides.date ?? "2026-06-10",
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
    periodSnapshots?: readonly PeriodSnapshot[];
  } = {},
): BudgetPlan => ({
  schemaVersion: budgetPlanSchemaVersion,
  id: "budget_dashboard_home",
  createdAt: "2026-06-01T08:00:00.000Z",
  updatedAt: "2026-06-01T08:00:00.000Z",
  mode: "general",
  currency: {
    code: "USD",
    decimalPlaces: 2,
    symbol: "$",
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
    savingsGoals: [],
    flexibleCategoryGuidance: overrides.flexibleCategoryGuidance ?? [],
  },
  balanceSnapshots: overrides.balanceSnapshots ?? [],
  financialEvents: overrides.financialEvents ?? [],
  periodSnapshots: overrides.periodSnapshots,
});

describe("dashboard home", () => {
  it("keeps rolled periods visible as dashboard history", () => {
    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={{
          ...plan({
            balanceSnapshots: [
              snapshot({
                id: "snapshot_new_period",
                date: "2026-07-01",
                amount: money(82_500),
              }),
            ],
            periodSnapshots: [
              {
                id: "period_snapshot_june",
                createdAt: "2026-07-01T08:00:00.000Z",
                updatedAt: "2026-07-01T08:00:00.000Z",
                period: {
                  startDate: "2026-06-01",
                  endDate: "2026-06-30",
                },
                startingAvailableMoney: money(100_000),
                endingEffectiveAvailableMoney: money(80_000),
                totalSpending: money(20_000),
                totalCommitmentsPaid: money(0),
                totalSavingsContributions: money(0),
                finalHealthStatus: "safe",
              },
            ],
          }),
          activePeriod: {
            startDate: "2026-07-01",
            endDate: "2026-07-30",
          },
        }}
        today="2026-07-01"
      />,
    );

    expect(html).toContain("Previous periods");
    expect(html).toContain("History kept as snapshots");
    expect(html).toContain("June 1, 2026 to June 30, 2026");
    expect(html).toContain("Ending available money");
    expect(html).toContain("$800.00");
    expect(html).toContain("Spent");
    expect(html).toContain("$200.00");
  });

  it("presents an ending active period before it rolls over", () => {
    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          balanceSnapshots: [
            snapshot({
              id: "snapshot_ending",
              amount: money(75_000),
            }),
          ],
        })}
        today="2026-06-30"
      />,
    );

    expect(html).toContain("Period ending today");
    expect(html).toContain("Review June 1, 2026 to June 30, 2026");
    expect(html).toContain("Rollover is optional until you confirm it.");
  });

  it("shows an explicit rollover review when the active period has ended", () => {
    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          fixedBuffer: money(5_000),
          balanceSnapshots: [
            snapshot({
              id: "snapshot_ended",
              amount: money(100_000),
            }),
          ],
          financialEvents: [
            event({
              id: "spend_end_period",
              amount: money(20_000),
              date: "2026-06-20",
            }),
          ],
        })}
        today="2026-07-01"
      />,
    );

    expect(html).toContain("Ready to roll this period forward");
    expect(html).toContain("Review June 1, 2026 to June 30, 2026");
    expect(html).toContain("Opening balance for the next period");
    expect(html).toContain("This creates July 1, 2026 to July 30, 2026");
    expect(html).toContain(
      "Your June 1, 2026 to June 30, 2026 history will be kept as a period snapshot.",
    );
    expect(html).toContain("Roll forward");
  });

  it("surfaces the highest-priority warning prominently and keeps the rest secondary", () => {
    const dining = category({
      id: "category_dining",
      name: "Dining out",
    });

    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          fixedBuffer: money(5_000),
          balanceSnapshots: [
            snapshot({
              id: "snapshot_opening",
              amount: money(100_000),
            }),
          ],
          commitmentTemplates: [
            commitment({
              id: "bill_power",
              name: "Power bill",
              amount: money(15_000),
              startsOn: "2026-06-09",
            }),
            commitment({
              id: "debt_card",
              name: "Card payment",
              kind: "debt",
              amount: money(25_000),
              startsOn: "2026-06-10",
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
              amount: money(15_000),
              categoryId: dining.id,
            }),
          ],
        })}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Safe to spend today");
    expect(html).toContain("Top priority");
    expect(html).toContain("A commitment is overdue");
    expect(html).toContain("Settle or update this overdue commitment before spending more.");
    expect(html).toContain("$150.00");
    expect(html).toContain("More budget warnings");
    expect(html).toContain("A commitment is due today");
    expect(html).toContain("$250.00");
    expect(html).toContain("Category spending is over guidance");
    expect(html).toContain("$50.00");
  });

  it("explains spending effects and invites refinement for a sparse saved budget", () => {
    const sparsePlan = plan({
      balanceSnapshots: [
        snapshot({
          id: "snapshot_sparse",
          amount: money(42_000),
        }),
      ],
    });

    const sparseHtml = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={sparsePlan}
        today="2026-06-10"
      />,
    );

    expect(sparseHtml).toContain("Safe to spend today");
    expect(sparseHtml).toContain("Refine this budget");
    expect(sparseHtml).toContain(
      "Your budget is ready to use. Add commitments, protected savings, or a buffer when you want a sharper number.",
    );

    const spendingHtml = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          balanceSnapshots: [
            snapshot({
              id: "snapshot_with_spending",
              amount: money(100_000),
            }),
          ],
          financialEvents: [
            event({
              id: "spend_groceries",
              amount: money(15_000),
              note: "Groceries",
            }),
          ],
        })}
        today="2026-06-10"
      />,
    );

    expect(spendingHtml).toContain("Spending logged this period");
    expect(spendingHtml).toContain("$150.00");
    expect(spendingHtml).toContain(
      "Spending and payments are already reflected in available money.",
    );
  });
});
