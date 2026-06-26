import {
  rollBudgetPlanPeriodForward,
  suggestNextActivePeriod,
} from "../application";
import type { ApplicationServices } from "../application";
import { calculateSafeToSpend } from "../domain";
import type { BudgetPlan, Money, SafeToSpendResult } from "../domain";
import type { BudgetPlanRepository } from "../infrastructure";

export interface CompletePeriodRolloverInput {
  plan: BudgetPlan;
  confirmedAvailableMoney: Money;
}

export interface CompletePeriodRolloverDependencies {
  repository: BudgetPlanRepository;
  services: ApplicationServices;
}

export interface PeriodRolloverCompletion {
  plan: BudgetPlan;
  result: SafeToSpendResult;
}

export async function completePeriodRollover(
  input: CompletePeriodRolloverInput,
  dependencies: CompletePeriodRolloverDependencies,
): Promise<PeriodRolloverCompletion> {
  const nextPeriod = suggestNextActivePeriod(input.plan);
  const plan = rollBudgetPlanPeriodForward(
    input.plan,
    {
      newActivePeriod: nextPeriod,
      confirmedAvailableMoney: input.confirmedAvailableMoney,
    },
    dependencies.services,
  );

  await dependencies.repository.saveActivePlan(plan);

  return {
    plan,
    result: calculateSafeToSpend({
      plan,
      today: nextPeriod.startDate,
    }),
  };
}
