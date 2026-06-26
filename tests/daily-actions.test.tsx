import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createBudgetPlan } from "../src/application";
import { App } from "../src/app/App";
import type { ApplicationServices } from "../src/application";
import type { BudgetPlanRepository } from "../src/infrastructure";
import type { BudgetPlan, Money } from "../src/domain";
import {
  correctDailyActivity,
  deleteDailyActivity,
  performDailyAction,
  undoLastDailyActivity,
} from "../src/features/dailyActions";

const money = (minorUnits: number): Money => minorUnits;

const testServices = (): ApplicationServices => {
  let nextId = 0;

  return {
    generateId: (prefix) => `${prefix}_${++nextId}`,
    now: () => "2026-06-10T09:00:00.000Z",
  };
};

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
      defaultCategories: [
        {
          name: "Groceries",
          kind: "flexible",
        },
      ],
    },
    services,
  );

class InMemoryBudgetPlanRepository implements BudgetPlanRepository {
  savedPlans: BudgetPlan[] = [];

  async saveActivePlan(plan: BudgetPlan): Promise<void> {
    this.savedPlans.push(plan);
  }

  async loadActivePlan(): Promise<BudgetPlan | undefined> {
    return this.savedPlans.at(-1);
  }
}

describe("daily dashboard actions", () => {
  it("logs spending, persists immediately, recalculates safe-to-spend, and shows recent activity", async () => {
    const services = testServices();
    const repository = new InMemoryBudgetPlanRepository();
    const plan = testPlan(services);

    const completion = await performDailyAction(
      plan,
      {
        kind: "log-spending",
        amount: "$25.00",
        categoryId: "category_2",
        note: "Groceries",
        date: "2026-06-10",
      },
      {
        repository,
        services,
        today: "2026-06-10",
      },
    );

    expect(repository.savedPlans).toEqual([completion.plan]);
    expect(completion.result.confirmed.safeToday).toBe(money(87_500));

    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={completion.plan}
        repository={repository}
        services={services}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Log spending");
    expect(html).toContain("Recent activity");
    expect(html).toContain("Groceries");
    expect(html).toContain("$25.00");
    expect(html).toContain("$875.00");
  });

  it("updates the current balance through an amount-first check-in and shows the balance activity", async () => {
    const services = testServices();
    const repository = new InMemoryBudgetPlanRepository();
    const plan = testPlan(services);

    const completion = await performDailyAction(
      plan,
      {
        kind: "update-balance",
        amount: "$800.00",
        note: "Checked bank balance",
        date: "2026-06-10",
      },
      {
        repository,
        services,
        today: "2026-06-10",
      },
    );

    expect(repository.savedPlans).toEqual([completion.plan]);
    expect(completion.result.confirmed.safeToday).toBe(money(70_000));

    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={completion.plan}
        repository={repository}
        services={services}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Update current balance");
    expect(html).toContain("Checked bank balance");
    expect(html).toContain("$800.00");
    expect(html).toContain("$700.00");
  });

  it("confirms income received from an income template and shows the income activity", async () => {
    const services = testServices();
    const repository = new InMemoryBudgetPlanRepository();
    const plan = createBudgetPlan(
      {
        mode: "fixed-income",
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
        initialIncomeTemplates: [
          {
            name: "Paycheck",
            amount: money(12_000),
            active: true,
            startsOn: "2026-06-10",
            recurrence: {
              frequency: "one-time",
              interval: 1,
              anchorDate: "2026-06-10",
            },
            includeInProjection: true,
          },
        ],
      },
      services,
    );

    const completion = await performDailyAction(
      plan,
      {
        kind: "confirm-income",
        amount: "$120.00",
        incomeTemplateId: "income-template_2",
        note: "Paycheck",
        date: "2026-06-10",
      },
      {
        repository,
        services,
        today: "2026-06-10",
      },
    );

    expect(repository.savedPlans).toEqual([completion.plan]);
    expect(completion.result.confirmed.safeToday).toBe(money(102_000));

    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={completion.plan}
        repository={repository}
        services={services}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Confirm income");
    expect(html).toContain("Paycheck");
    expect(html).toContain("$120.00");
    expect(html).toContain("$1,020.00");
  });

  it("records a savings contribution when a savings goal exists and shows the savings activity", async () => {
    const services = testServices();
    const repository = new InMemoryBudgetPlanRepository();
    const plan = createBudgetPlan(
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
        initialSavingsGoals: [
          {
            name: "Emergency fund",
            targetAmount: money(30_000),
            currentAmount: money(0),
            targetDate: "2026-06-30",
            status: "active",
            protected: true,
          },
        ],
      },
      services,
    );

    const completion = await performDailyAction(
      plan,
      {
        kind: "record-savings-contribution",
        amount: "$50.00",
        savingsGoalId: "savings-goal_2",
        note: "Emergency fund",
        date: "2026-06-10",
      },
      {
        repository,
        services,
        today: "2026-06-10",
      },
    );

    expect(repository.savedPlans).toEqual([completion.plan]);
    expect(completion.result.confirmed.safeToday).toBe(money(80_000));

    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={completion.plan}
        repository={repository}
        services={services}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Record savings contribution");
    expect(html).toContain("Emergency fund");
    expect(html).toContain("$50.00");
    expect(html).toContain("$800.00");
  });

  it("corrects a spending activity and recalculates the dashboard result", async () => {
    const services = testServices();
    const repository = new InMemoryBudgetPlanRepository();
    const plan = testPlan(services);
    const logged = await performDailyAction(
      plan,
      {
        kind: "log-spending",
        amount: "$25.00",
        categoryId: "category_2",
        note: "Groceries",
        date: "2026-06-10",
      },
      {
        repository,
        services,
        today: "2026-06-10",
      },
    );

    const corrected = await correctDailyActivity(
      logged.plan,
      {
        kind: "financial-event",
        id: "financial-event_4",
        amount: "$15.00",
        note: "Corrected groceries",
      },
      {
        repository,
        services,
        today: "2026-06-10",
      },
    );

    expect(repository.savedPlans.at(-1)).toBe(corrected.plan);
    expect(corrected.result.confirmed.safeToday).toBe(money(88_500));

    const html = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={corrected.plan}
        repository={repository}
        services={services}
        today="2026-06-10"
      />,
    );

    expect(html).toContain("Correct activity");
    expect(html).toContain("Corrected groceries");
    expect(html).toContain("$15.00");
    expect(html).toContain("$885.00");
  });

  it("deletes and undoes supported activity entries with immediate recalculation", async () => {
    const services = testServices();
    const repository = new InMemoryBudgetPlanRepository();
    const plan = testPlan(services);
    const logged = await performDailyAction(
      plan,
      {
        kind: "log-spending",
        amount: "$25.00",
        categoryId: "category_2",
        note: "Groceries",
        date: "2026-06-10",
      },
      {
        repository,
        services,
        today: "2026-06-10",
      },
    );

    const deleted = await deleteDailyActivity(
      logged.plan,
      {
        kind: "financial-event",
        id: "financial-event_4",
      },
      {
        repository,
        services,
        today: "2026-06-10",
      },
    );
    const undone = await undoLastDailyActivity(logged.plan, {
      repository,
      services,
      today: "2026-06-10",
    });

    expect(deleted.result.confirmed.safeToday).toBe(money(90_000));
    expect(undone.result.confirmed.safeToday).toBe(money(90_000));
    expect(deleted.plan.financialEvents).toHaveLength(0);
    expect(undone.plan.financialEvents).toHaveLength(0);

    const loggedHtml = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={logged.plan}
        repository={repository}
        services={services}
        today="2026-06-10"
      />,
    );
    const undoneHtml = renderToStaticMarkup(
      <App
        initialView="dashboard"
        initialPlan={undone.plan}
        repository={repository}
        services={services}
        today="2026-06-10"
      />,
    );

    expect(loggedHtml).toContain("Delete activity");
    expect(loggedHtml).toContain("Undo last action");
    expect(undoneHtml).not.toContain("<span>Groceries</span>");
    expect(undoneHtml).toContain("$900.00");
  });
});
