import { describe, expect, it } from "vitest";

import { createBudgetPlan } from "../src/application";
import type { ApplicationServices } from "../src/application";
import {
  applyConfirmedSimulatorScenario,
  previewSimulatorScenario,
} from "../src/features/simulator";
import type { BudgetPlanRepository } from "../src/infrastructure";
import type { BudgetPlan, Money } from "../src/domain";

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

describe("simulator workflow", () => {
  it("keeps preview scenarios temporary and only persists after explicit confirmation", async () => {
    const services = testServices();
    const repository = new InMemoryBudgetPlanRepository();
    const plan = testPlan(services);
    const scenario = {
      kind: "one-time-spend" as const,
      id: "scenario_extra_spend",
      date: "2026-06-10",
      amount: money(2_500),
      note: "What-if extra spending",
    };

    const preview = previewSimulatorScenario({
      plan,
      today: "2026-06-10",
      scenario,
    });

    expect(preview.current.confirmed.safeThisPeriod).toBe(money(60_000));
    expect(preview.simulated.confirmed.safeThisPeriod).toBe(money(57_500));
    expect(plan.financialEvents).toEqual([]);
    expect(repository.savedPlans).toEqual([]);

    await expect(
      applyConfirmedSimulatorScenario(
        {
          plan,
          today: "2026-06-10",
          scenario,
          confirmed: false,
        },
        {
          repository,
          services,
        },
      ),
    ).rejects.toThrow(/confirm/i);
    expect(repository.savedPlans).toEqual([]);

    const completion = await applyConfirmedSimulatorScenario(
      {
        plan,
        today: "2026-06-10",
        scenario,
        confirmed: true,
      },
      {
        repository,
        services,
      },
    );

    expect(repository.savedPlans).toEqual([completion.plan]);
    expect(completion.plan.financialEvents).toEqual([
      expect.objectContaining({
        kind: "spending",
        amount: money(2_500),
        note: "What-if extra spending",
      }),
    ]);
    expect(completion.result.confirmed.safeThisPeriod).toBe(money(57_500));
  });
});
