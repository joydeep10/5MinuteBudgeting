import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { markCommitmentPaid } from "../src/application";
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
});

describe("dashboard home", () => {
  it("updates the visible commitment warning and safe-to-spend result after payments", () => {
    const commitmentPlan = plan({
      balanceSnapshots: [
        snapshot({
          id: "snapshot_payment",
          amount: money(100_000),
        }),
      ],
      commitmentTemplates: [
        commitment({
          id: "bill_rent",
          name: "Rent",
          amount: money(30_000),
          startsOn: "2026-06-09",
        }),
      ],
    });
    const services = {
      generateId: (prefix: string) => `${prefix}_payment`,
      now: () => "2026-06-10T08:00:00.000Z",
    };

    const partiallyPaid = markCommitmentPaid(
      commitmentPlan,
      {
        date: "2026-06-10",
        commitmentTemplateId: "bill_rent",
        occurrenceDate: "2026-06-09",
        amount: money(10_000),
      },
      services,
    );

    const partialHtml = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={partiallyPaid}
        today="2026-06-10"
      />,
    );

    expect(partialHtml).toContain("$100.00 paid of $300.00");
    expect(partialHtml).toContain("$200.00 remaining");
    expect(partialHtml).toContain("A commitment is overdue");
    expect(partialHtml).toContain("Safe this period");
    expect(partialHtml).toContain("$700.00");

    const fullyPaid = markCommitmentPaid(
      partiallyPaid,
      {
        date: "2026-06-10",
        commitmentTemplateId: "bill_rent",
        occurrenceDate: "2026-06-09",
      },
      services,
    );

    const fullHtml = renderToStaticMarkup(
      <App initialView="dashboard" initialPlan={fullyPaid} today="2026-06-10" />,
    );

    expect(fullHtml).toContain("$300.00 paid of $300.00");
    expect(fullHtml).toContain("$0.00 remaining");
    expect(fullHtml).toContain("Paid in full");
    expect(fullHtml).not.toContain("A commitment is overdue");
    expect(fullHtml).toContain("$700.00");
  });

  it("shows commitments with overdue and due-today items first plus payment and edit actions", () => {
    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          balanceSnapshots: [
            snapshot({
              id: "snapshot_commitments",
              amount: money(100_000),
            }),
          ],
          commitmentTemplates: [
            commitment({
              id: "bill_future",
              name: "Internet",
              amount: money(8_000),
              startsOn: "2026-06-20",
              recurrence: {
                frequency: "monthly",
                interval: 1,
                anchorDate: "2026-06-20",
                monthly: {
                  dayOfMonth: 20,
                  missingDayBehavior: "last-valid-day",
                },
              },
            }),
            commitment({
              id: "bill_overdue",
              name: "Rent",
              amount: money(30_000),
              startsOn: "2026-06-09",
            }),
            commitment({
              id: "debt_today",
              name: "Card EMI",
              kind: "debt",
              amount: money(15_000),
              startsOn: "2026-06-10",
            }),
          ],
          financialEvents: [
            event({
              id: "rent_part_payment",
              date: "2026-06-09",
              kind: "commitment-payment",
              amount: money(5_000),
              commitmentTemplateId: "bill_overdue",
              occurrenceDate: "2026-06-09",
            }),
          ],
        })}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Commitments");
    expect(html.indexOf("Rent")).toBeLessThan(html.indexOf("Card EMI"));
    expect(html.indexOf("Card EMI")).toBeLessThan(html.indexOf("Internet"));
    expect(html).toContain("Overdue");
    expect(html).toContain("Due today");
    expect(html).toContain("Due Jun 20");
    expect(html).toContain("Monthly bill");
    expect(html).toContain("$50.00 paid of $300.00");
    expect(html).toContain("$250.00 remaining");
    expect(html).toContain("Record partial payment");
    expect(html).toContain("Mark paid in full");
    expect(html).toContain("Add or edit commitment");
    expect(html).toContain("Commitment type");
    expect(html).toContain("Rent");
    expect(html).toContain("EMI");
    expect(html).toContain("Utilities");
    expect(html).toContain("Subscriptions");
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
