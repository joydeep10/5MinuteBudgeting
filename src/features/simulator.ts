import {
  addCommitmentTemplate,
  confirmIncomeReceived,
  logSpending,
  updateCommitmentTemplate,
  updateSavingsGoal,
} from "../application";
import type { ApplicationServices } from "../application";
import {
  calculateSafeToSpend,
  simulateBudgetPlan,
} from "../domain";
import type {
  BudgetPlan,
  BudgetSimulationResult,
  BudgetSimulationScenario,
  DateOnly,
  SafeToSpendResult,
} from "../domain";
import type { BudgetPlanRepository } from "../infrastructure";

export interface PreviewSimulatorScenarioInput {
  plan: BudgetPlan;
  today: DateOnly;
  scenario: BudgetSimulationScenario;
}

export interface ApplyConfirmedSimulatorScenarioInput
  extends PreviewSimulatorScenarioInput {
  confirmed: boolean;
}

export interface ApplyConfirmedSimulatorScenarioDependencies {
  repository: BudgetPlanRepository;
  services: ApplicationServices;
}

export interface SimulatorApplyCompletion {
  plan: BudgetPlan;
  result: SafeToSpendResult;
}

export function previewSimulatorScenario({
  plan,
  today,
  scenario,
}: PreviewSimulatorScenarioInput): BudgetSimulationResult {
  return simulateBudgetPlan({
    plan,
    today,
    scenarios: [scenario],
  });
}

export async function applyConfirmedSimulatorScenario(
  input: ApplyConfirmedSimulatorScenarioInput,
  dependencies: ApplyConfirmedSimulatorScenarioDependencies,
): Promise<SimulatorApplyCompletion> {
  if (!input.confirmed) {
    throw new RangeError("Confirm before applying a simulator scenario.");
  }

  const plan = applySimulatorScenarioToPlan(
    input.plan,
    input.scenario,
    dependencies.services,
  );

  await dependencies.repository.saveActivePlan(plan);

  return {
    plan,
    result: calculateSafeToSpend({
      plan,
      today: input.today,
    }),
  };
}

function applySimulatorScenarioToPlan(
  plan: BudgetPlan,
  scenario: BudgetSimulationScenario,
  services: ApplicationServices,
): BudgetPlan {
  if (scenario.kind === "one-time-spend") {
    return logSpending(
      plan,
      {
        amount: scenario.amount,
        categoryId: scenario.categoryId,
        date: scenario.date,
        note: scenario.note,
      },
      services,
    );
  }

  if (scenario.kind === "available-money-adjustment") {
    if (scenario.amountDelta >= 0) {
      return confirmIncomeReceived(
        plan,
        {
          amount: scenario.amountDelta,
          date: scenario.date,
          note: scenario.note,
        },
        services,
      );
    }

    return logSpending(
      plan,
      {
        amount: Math.abs(scenario.amountDelta),
        date: scenario.date,
        note: scenario.note,
      },
      services,
    );
  }

  if (scenario.kind === "commitment-add") {
    return addCommitmentTemplate(
      plan,
      {
        name: scenario.commitment.name,
        kind: scenario.commitment.kind,
        amount: scenario.commitment.amount,
        active: scenario.commitment.active,
        startsOn: scenario.commitment.startsOn,
        endsOn: scenario.commitment.endsOn,
        recurrence: scenario.commitment.recurrence,
        categoryId: scenario.commitment.categoryId,
      },
      services,
    );
  }

  if (scenario.kind === "commitment-change") {
    const existing = plan.plannedRecords.commitmentTemplates.find(
      (commitment) => commitment.id === scenario.commitmentTemplateId,
    );

    if (existing === undefined) {
      throw new RangeError("Commitment was not found.");
    }

    return updateCommitmentTemplate(
      plan,
      scenario.commitmentTemplateId,
      {
        name: scenario.changes.name ?? existing.name,
        kind: scenario.changes.kind ?? existing.kind,
        amount: scenario.changes.amount ?? existing.amount,
        active: scenario.changes.active ?? existing.active,
        startsOn: scenario.changes.startsOn ?? existing.startsOn,
        endsOn: scenario.changes.endsOn ?? existing.endsOn,
        recurrence: scenario.changes.recurrence ?? existing.recurrence,
        categoryId: scenario.changes.categoryId ?? existing.categoryId,
      },
      services,
    );
  }

  if (scenario.kind === "commitment-remove") {
    return {
      ...plan,
      updatedAt: services.now(),
      plannedRecords: {
        ...plan.plannedRecords,
        commitmentTemplates: plan.plannedRecords.commitmentTemplates.filter(
          (commitment) => commitment.id !== scenario.commitmentTemplateId,
        ),
      },
    };
  }

  if (scenario.kind === "buffer-change") {
    return {
      ...plan,
      updatedAt: services.now(),
      fixedBuffer: scenario.fixedBuffer,
    };
  }

  if (scenario.kind === "savings-goal-change") {
    return updateSavingsGoal(
      plan,
      {
        savingsGoalId: scenario.savingsGoalId,
        status: scenario.status,
        protected: scenario.protected,
      },
      services,
    );
  }

  return plan;
}
