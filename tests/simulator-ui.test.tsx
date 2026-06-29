import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createBudgetPlan } from "../src/application";
import { App } from "../src/app/App";
import type { ApplicationServices } from "../src/application";
import type { BudgetPlan, Money } from "../src/domain";

const money = (minorUnits: number): Money => minorUnits;

const testServices = (): ApplicationServices => ({
  generateId: (prefix) => `${prefix}_1`,
  now: () => "2026-06-10T09:00:00.000Z",
});

const testPlan = (services: ApplicationServices): BudgetPlan =>
  createBudgetPlan(
    {
      mode: "general",
      currency: {
        code: "USD",
        decimalPlaces: 2,
        symbol: "$",
      },
      activePeriod: {
        startDate: "2026-06-01",
        endDate: "2026-06-10",
      },
      fixedBuffer: money(10_000),
      startingAvailableMoney: money(100_000),
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
          targetAmount: money(60_000),
          currentAmount: money(10_000),
          targetDate: "2026-06-30",
          status: "active",
          protected: true,
          periodContributionOverride: money(20_000),
        },
      ],
    },
    services,
  );

describe("guided what-if simulator UI", () => {
  it("opens from dashboard context and shows guided scenario cards with before and after impact", () => {
    const services = testServices();
    const plan = testPlan(services);

    const dashboardHtml = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={plan}
        services={services}
        today="2026-06-10"
      />,
    );
    const simulatorHtml = renderToStaticMarkup(
      <App
        initialView="simulator"
        initialPlan={plan}
        services={services}
        today="2026-06-10"
      />,
    );

    expect(dashboardHtml).toContain("Simulator");
    expect(simulatorHtml).toContain("What-if simulator");
    expect(simulatorHtml).toContain("Spend extra");
    expect(simulatorHtml).toContain("Change a bill");
    expect(simulatorHtml).toContain("Change buffer");
    expect(simulatorHtml).toContain("Adjust a savings goal");
    expect(simulatorHtml).toContain("Before");
    expect(simulatorHtml).toContain("After");
    expect(simulatorHtml).toContain("Safe this period");
    expect(simulatorHtml).toContain("Current warnings");
    expect(simulatorHtml).toContain("Simulated warnings");
    expect(simulatorHtml).toContain("A commitment is due today");
    expect(simulatorHtml).toContain("$400.00");
    expect(simulatorHtml).toContain("$375.00");
    expect(simulatorHtml).toContain("No budget data changes until you apply.");
    expect(simulatorHtml).toContain("Confirm before changing your budget");
    expect(simulatorHtml).toContain("Apply scenario");
    expect(simulatorHtml).toContain("Cancel and return");
  });
});
