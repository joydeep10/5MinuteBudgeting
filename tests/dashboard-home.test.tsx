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
  PeriodSnapshot,
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

const plan = (
  overrides: {
    fixedBuffer?: Money;
    balanceSnapshots?: readonly BalanceSnapshot[];
    financialEvents?: readonly FinancialEventRecord[];
    categories?: readonly Category[];
    flexibleCategoryGuidance?: readonly FlexibleCategoryGuidance[];
    commitmentTemplates?: readonly CommitmentTemplate[];
    periodSnapshots?: readonly PeriodSnapshot[];
    savingsGoals?: readonly SavingsGoal[];
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
    savingsGoals: overrides.savingsGoals ?? [],
    flexibleCategoryGuidance: overrides.flexibleCategoryGuidance ?? [],
  },
  balanceSnapshots: overrides.balanceSnapshots ?? [],
  financialEvents: overrides.financialEvents ?? [],
  periodSnapshots: overrides.periodSnapshots,
});

describe("dashboard home", () => {
  it("shows local-save reassurance, backup/import choices, and snapshot export messaging", () => {
    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          balanceSnapshots: [
            snapshot({
              id: "snapshot_data_safety",
              amount: money(80_000),
            }),
          ],
        })}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Saved on this device");
    expect(html).toContain(
      "Budget data stays local to this browser. Clearing browser data can remove it.",
    );
    expect(html).toContain("Back up this budget");
    expect(html).toContain("Export JSON backup");
    expect(html).toContain("Import JSON backup");
    expect(html).toContain("Review and replace this browser budget");
    expect(html).toContain("PDF snapshot");
    expect(html).toContain("Excel workbook");
    expect(html).toContain("Exports are snapshots");
    expect(html).toContain("Power BI-ready workbook export is not included in V1.");
  });

  it("lets users configure in-app reminders while browser notifications fall back when unsupported", () => {
    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          balanceSnapshots: [
            snapshot({
              id: "snapshot_reminders",
              amount: money(80_000),
            }),
          ],
        })}
        notificationAdapter={{
          permissionStatus: () => "unsupported",
          requestPermission: async () => "unsupported",
        }}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Reminders");
    expect(html).toContain("Daily check-in");
    expect(html).toContain("Due-item reminders");
    expect(html).toContain("Save reminder settings");
    expect(html).toContain("Browser notifications are not supported here.");
    expect(html).toContain("In-app reminders still work while this budget is open.");
    expect(html).not.toContain("closed-app mobile push");
    expect(html).not.toContain("PWA");
  });

  it("shows saved reminder choices instead of forcing every reminder on", () => {
    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={{
          ...plan({
            balanceSnapshots: [
              snapshot({
                id: "snapshot_saved_reminders",
                amount: money(80_000),
              }),
            ],
          }),
          reminderPreferences: {
            dailyCheckInEnabled: false,
            dailyCheckInTime: "07:30",
            dueItemRemindersEnabled: false,
            browserNotificationsEnabled: false,
          },
        }}
        notificationAdapter={{
          permissionStatus: () => "default",
          requestPermission: async () => "granted",
        }}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Daily check-in off");
    expect(html).toContain("Due-item reminders off");
    expect(html).toContain("07:30");
    expect(html).toContain("Enable browser notifications");
  });

  it("shows in-app due-item reminders for overdue and due-today commitments", () => {
    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          balanceSnapshots: [
            snapshot({
              id: "snapshot_due_reminders",
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
            commitment({
              id: "debt_card",
              name: "Card payment",
              kind: "debt",
              amount: money(25_000),
              startsOn: "2026-06-10",
            }),
            commitment({
              id: "bill_internet",
              name: "Internet",
              amount: money(8_000),
              startsOn: "2026-06-20",
            }),
          ],
        })}
        notificationAdapter={{
          permissionStatus: () => "denied",
          requestPermission: async () => "denied",
        }}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("In-app reminders");
    expect(html).toContain("Reminder: Rent is overdue");
    expect(html).toContain("Reminder: Card payment is due today");
    expect(html).not.toContain("Reminder: Internet");
    expect(html).toContain("Browser notifications are blocked.");
  });

  it("only offers browser notification permission from the dashboard reminder context", () => {
    const notificationAdapter = {
      permissionStatus: () => "default" as const,
      requestPermission: async () => "granted" as const,
    };
    const landingHtml = renderToStaticMarkup(
      <App notificationAdapter={notificationAdapter} />,
    );
    const setupHtml = renderToStaticMarkup(
      <App initialView="setup" notificationAdapter={notificationAdapter} />,
    );
    const dashboardHtml = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          balanceSnapshots: [
            snapshot({
              id: "snapshot_notification_context",
              amount: money(80_000),
            }),
          ],
        })}
        notificationAdapter={notificationAdapter}
        today="2026-06-10"
      />,
    );

    expect(landingHtml).not.toContain("Enable browser notifications");
    expect(setupHtml).not.toContain("Enable browser notifications");
    expect(dashboardHtml).toContain("Enable browser notifications");
  });

  it("shows granted browser notifications as enabled without another permission prompt", () => {
    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          balanceSnapshots: [
            snapshot({
              id: "snapshot_granted_notifications",
              amount: money(80_000),
            }),
          ],
        })}
        notificationAdapter={{
          permissionStatus: () => "granted",
          requestPermission: async () => "granted",
        }}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Browser notifications are enabled for supported reminders.");
    expect(html).not.toContain("Enable browser notifications");
  });

  it("uses text cues and situation-impact-action copy for warning severity treatments", () => {
    const dining = category({
      id: "category_dining_warning_copy",
      name: "Dining out",
    });

    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          balanceSnapshots: [
            snapshot({
              id: "snapshot_warning_copy",
              amount: money(100_000),
            }),
          ],
          commitmentTemplates: [
            commitment({
              id: "bill_power_warning_copy",
              name: "Power bill",
              amount: money(15_000),
              startsOn: "2026-06-09",
            }),
            commitment({
              id: "debt_card_warning_copy",
              name: "Card payment",
              kind: "debt",
              amount: money(25_000),
              startsOn: "2026-06-10",
            }),
          ],
          categories: [dining],
          flexibleCategoryGuidance: [
            guidance({
              id: "guidance_dining_warning_copy",
              categoryId: dining.id,
              periodLimit: money(10_000),
            }),
          ],
          financialEvents: [
            event({
              id: "spend_dining_warning_copy",
              amount: money(15_000),
              categoryId: dining.id,
            }),
          ],
        })}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Critical");
    expect(html).toContain("Warning");
    expect(html).toContain("Guidance");
    expect(html).toContain("Situation:");
    expect(html).toContain("Impact:");
    expect(html).toContain("Next action:");
  });

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

  it("shows savings and category guidance workflows without treating category guidance as protected money", () => {
    const food = category({
      id: "category_food",
      name: "Food",
    });
    const custom = category({
      id: "category_pet_care",
      name: "Pet care",
      kind: "custom",
    });

    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan({
          balanceSnapshots: [
            snapshot({
              id: "snapshot_opening",
              amount: money(100_000),
            }),
          ],
          savingsGoals: [
            goal({
              id: "goal_emergency",
              name: "Emergency fund",
              targetAmount: money(60_000),
              currentAmount: money(10_000),
              periodContributionOverride: money(30_000),
            }),
          ],
          categories: [food, custom],
          flexibleCategoryGuidance: [
            guidance({
              id: "guidance_food",
              categoryId: food.id,
              periodLimit: money(20_000),
            }),
            guidance({
              id: "guidance_pet_care",
              categoryId: custom.id,
              periodLimit: money(12_000),
            }),
          ],
          financialEvents: [
            event({
              id: "emergency_contribution",
              date: "2026-06-10",
              kind: "savings-contribution",
              amount: money(10_000),
              savingsGoalId: "goal_emergency",
            }),
          ],
        })}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Savings goals");
    expect(html).toContain("set this money aside before calculating what I can spend");
    expect(html).toContain("Emergency fund");
    expect(html).toContain("Protected");
    expect(html).toContain("Record contribution");
    expect(html).toContain("Save goal changes");
    expect(html).toContain("Pause goal");
    expect(html).toContain("Complete goal");
    expect(html).toContain("Archive goal");
    expect(html).toContain("Protected savings");
    expect(html).toContain("$200.00");
    expect(html).toContain("Category guidance");
    expect(html).toContain("Optional visual guidance");
    expect(html).toContain("does not reduce safe-to-spend");
    expect(html).toContain("Food");
    expect(html).toContain("Pet care");
    expect(html).toContain("Add custom category");
    expect(html).toContain("Set guidance");
  });
});
