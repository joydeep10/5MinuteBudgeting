import { describe, expect, it } from "vitest";

import { createBudgetPlan, logSpending } from "../src/application";
import type { BudgetPlan, Money } from "../src/domain";
import type { BudgetPlanRepository } from "../src/infrastructure";
import { completePeriodRollover } from "../src/features/periodRollover";

const money = (minorUnits: number): Money => minorUnits;

const testServices = () => {
  let nextId = 0;

  return {
    generateId: (prefix: string) => `${prefix}_${++nextId}`,
    now: () => "2026-07-01T08:00:00.000Z",
  };
};

describe("period rollover feature", () => {
  it("confirms an adjusted opening balance, persists the next active period, and keeps the previous period snapshot", async () => {
    const services = testServices();
    const savedPlans: BudgetPlan[] = [];
    const repository: BudgetPlanRepository = {
      saveActivePlan: async (plan) => {
        savedPlans.push(plan);
      },
      loadActivePlan: async () => savedPlans.at(-1),
    };
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
          endDate: "2026-06-30",
        },
        fixedBuffer: money(5_000),
        startingAvailableMoney: money(100_000),
      },
      services,
    );
    const endedPlan = logSpending(
      plan,
      {
        date: "2026-06-20",
        amount: money(20_000),
        note: "Groceries",
      },
      services,
    );

    const completion = await completePeriodRollover(
      {
        plan: endedPlan,
        confirmedAvailableMoney: money(82_500),
      },
      {
        repository,
        services,
      },
    );

    expect(savedPlans).toHaveLength(1);
    expect(savedPlans[0]).toEqual(completion.plan);
    expect(completion.plan.activePeriod).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-30",
    });
    expect(completion.plan.balanceSnapshots.at(-1)).toMatchObject({
      date: "2026-07-01",
      amount: 82_500,
      note: "Roll-forward opening balance",
    });
    expect(completion.plan.periodSnapshots).toEqual([
      expect.objectContaining({
        period: {
          startDate: "2026-06-01",
          endDate: "2026-06-30",
        },
        startingAvailableMoney: 100_000,
        endingEffectiveAvailableMoney: 80_000,
        totalSpending: 20_000,
      }),
    ]);
    expect(completion.result.breakdown.effectiveAvailableMoney).toBe(82_500);
    expect(completion.result.confirmed.safeThisPeriod).toBe(77_500);
  });

  it("recalculates safe-to-spend warnings from the confirmed opening balance after rollover", async () => {
    const services = testServices();
    const repository: BudgetPlanRepository = {
      saveActivePlan: async () => {},
      loadActivePlan: async () => undefined,
    };
    const endedPlan = createBudgetPlan(
      {
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
        fixedBuffer: money(5_000),
        startingAvailableMoney: money(100_000),
      },
      services,
    );

    const completion = await completePeriodRollover(
      {
        plan: endedPlan,
        confirmedAvailableMoney: money(3_000),
      },
      {
        repository,
        services,
      },
    );

    expect(completion.result.confirmed.safeToday).toBe(0);
    expect(completion.result.confirmed.safeThisPeriod).toBe(0);
    expect(completion.result.warnings[0]).toMatchObject({
      severity: "critical",
      code: "critical-shortfall",
      metadata: {
        shortfallAmount: 2_000,
      },
    });
  });
});
