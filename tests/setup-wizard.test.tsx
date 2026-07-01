import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "../src/app/App";
import type { BudgetPlan } from "../src/domain";
import type { BudgetPlanRepository } from "../src/infrastructure";
import {
  buildBudgetPlanFromSetup,
  completeSetupWizard,
} from "../src/features/setupWizard";

describe("first-use setup wizard", () => {
  it("shows a multi-step setup path with plain-language minimum inputs", () => {
    const html = renderToStaticMarkup(<App initialView="setup" />);

    expect(html).toContain("Set up your first budget");
    expect(html).toContain("1. Money you can use");
    expect(html).toContain("Currency");
    expect(html).toContain("Current usable balance");
    expect(html).toContain("Regular paycheck");
    expect(html).toContain("Irregular income");
    expect(html).toContain("General budget");
    expect(html).toContain("Next payday");
    expect(html).toContain("Rent");
    expect(html).toContain("EMI");
    expect(html).toContain("Utilities");
    expect(html).toContain("Subscriptions");
    expect(html).toContain("Custom");
    expect(html).toContain("I have none");
    expect(html).toContain("Safety buffer");
  });

  it("creates, persists, and calculates the first result from setup answers", async () => {
    const savedPlans: BudgetPlan[] = [];
    const repository: BudgetPlanRepository = {
      saveActivePlan: async (plan) => {
        savedPlans.push(plan);
      },
      loadActivePlan: async () => savedPlans.at(-1),
    };

    const completion = await completeSetupWizard(
      {
        currencyCode: "USD",
        currentUsableBalance: "$1,000.00",
        mode: "fixed-income",
        periodStartDate: "2026-06-25",
        nextPayday: "2026-07-01",
        commitments: [
          {
            shortcut: "Rent",
            amount: "$300.00",
            dueDate: "2026-06-28",
          },
        ],
        safetyBuffer: "$70.00",
      },
      {
        repository,
        services: {
          generateId: (prefix) => `${prefix}_test`,
          now: () => "2026-06-25T08:00:00.000Z",
        },
        today: "2026-06-25",
      },
    );

    expect(savedPlans).toHaveLength(1);
    expect(savedPlans[0]).toMatchObject({
      budgetingStyle: "regular-paycheck",
      incomeSchedule: { kind: "unconfigured" },
      currency: {
        code: "USD",
        decimalPlaces: 2,
        symbol: "$",
      },
      activePeriod: {
        startDate: "2026-06-25",
        endDate: "2026-07-01",
      },
      fixedBuffer: 7_000,
    });
    expect(savedPlans[0]?.balanceSnapshots[0]).toMatchObject({
      date: "2026-06-25",
      amount: 100_000,
      note: "Opening balance",
    });
    expect(savedPlans[0]?.plannedRecords.commitmentTemplates[0]).toMatchObject({
      name: "Rent",
      kind: "bill",
      amount: 30_000,
      startsOn: "2026-06-28",
    });
    expect(savedPlans[0]?.plannedRecords.categories.map(({ name }) => name)).toEqual([
      "Food",
      "Transport",
      "Shopping",
      "Health",
      "Entertainment",
      "Other",
    ]);
    expect(completion.result.confirmed.safeToday).toBe(9_000);
  });

  it("shows the first dashboard result from the saved setup plan", () => {
    const plan = buildBudgetPlanFromSetup(
      {
        currencyCode: "USD",
        currentUsableBalance: "$1,000.00",
        mode: "fixed-income",
        periodStartDate: "2026-06-25",
        nextPayday: "2026-07-01",
        commitments: [
          {
            shortcut: "Rent",
            amount: "$300.00",
            dueDate: "2026-06-28",
          },
        ],
        safetyBuffer: "$70.00",
      },
      {
        generateId: (prefix) => `${prefix}_dashboard`,
        now: () => "2026-06-25T08:00:00.000Z",
      },
    );

    const html = renderToStaticMarkup(
      <App initialView="dashboard" initialPlan={plan} today="2026-06-25" />,
    );

    expect(html).toContain("Safe to spend today");
    expect(html).toContain("$90.00");
    expect(html).toContain("Safe this week");
    expect(html).toContain("$630.00");
    expect(html).toContain("Available money");
    expect(html).toContain("$1,000.00");
    expect(html).toContain("Upcoming commitments");
    expect(html).toContain("$300.00");
    expect(html).toContain("Safety buffer");
    expect(html).toContain("$70.00");
  });

  it("shows a clearly labeled provisional estimate only after enough setup data exists", () => {
    const incompleteHtml = renderToStaticMarkup(
      <App
        initialView="setup"
        today="2026-06-25"
        initialSetupSubmission={{
          currencyCode: "USD",
          currentUsableBalance: "$1,000.00",
        }}
      />,
    );

    expect(incompleteHtml).not.toContain("Estimated safe to spend today");

    const completeHtml = renderToStaticMarkup(
      <App
        initialView="setup"
        today="2026-06-25"
        initialSetupSubmission={{
          currencyCode: "USD",
          currentUsableBalance: "$1,000.00",
          mode: "fixed-income",
          periodStartDate: "2026-06-25",
          nextPayday: "2026-07-01",
          commitments: [],
          safetyBuffer: "$70.00",
        }}
      />,
    );

    expect(completeHtml).toContain("Estimated safe to spend today");
    expect(completeHtml).toContain("This is an estimate");
    expect(completeHtml).toContain("$132.85");
  });
});
