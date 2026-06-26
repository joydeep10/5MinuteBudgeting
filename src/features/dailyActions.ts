import {
  confirmIncomeReceived,
  correctFinancialEvent,
  deleteFinancialEvent,
  logSpending,
  recordBalanceSnapshot,
  recordSavingsContribution,
} from "../application";
import type { ApplicationServices } from "../application";
import { calculateSafeToSpend } from "../domain";
import type {
  BudgetPlan,
  DateOnly,
  EntityId,
  Money,
  SafeToSpendResult,
} from "../domain";
import type { BudgetPlanRepository } from "../infrastructure";

export type DailyAction =
  | {
      kind: "log-spending";
      amount: string;
      date: DateOnly;
      categoryId?: EntityId;
      note?: string;
    }
  | {
      kind: "update-balance";
      amount: string;
      date: DateOnly;
      note?: string;
    }
  | {
      kind: "confirm-income";
      amount: string;
      date: DateOnly;
      incomeTemplateId?: EntityId;
      note?: string;
    }
  | {
      kind: "record-savings-contribution";
      amount: string;
      date: DateOnly;
      savingsGoalId: EntityId;
      note?: string;
    };

export interface DailyActionDependencies {
  repository: BudgetPlanRepository;
  services: ApplicationServices;
  today: DateOnly;
}

export interface DailyActionCompletion {
  plan: BudgetPlan;
  result: SafeToSpendResult;
}

export type DailyActivityCorrection =
  | {
      kind: "financial-event";
      id: EntityId;
      amount?: string;
      date?: DateOnly;
      categoryId?: EntityId;
      incomeTemplateId?: EntityId;
      savingsGoalId?: EntityId;
      note?: string;
    };

export type DailyActivityDeletion =
  | {
      kind: "financial-event";
      id: EntityId;
    };

export async function performDailyAction(
  plan: BudgetPlan,
  action: DailyAction,
  dependencies: DailyActionDependencies,
): Promise<DailyActionCompletion> {
  const updatedPlan = applyDailyAction(plan, action, dependencies.services);

  await dependencies.repository.saveActivePlan(updatedPlan);

  return {
    plan: updatedPlan,
    result: calculateSafeToSpend({
      plan: updatedPlan,
      today: dependencies.today,
    }),
  };
}

export async function correctDailyActivity(
  plan: BudgetPlan,
  correction: DailyActivityCorrection,
  dependencies: DailyActionDependencies,
): Promise<DailyActionCompletion> {
  const updatedPlan = correctFinancialEvent(
    plan,
    {
      id: correction.id,
      amount:
        correction.amount === undefined
          ? undefined
          : parseMoneyInput(correction.amount, plan, "Activity amount"),
      date: correction.date,
      categoryId: emptyToUndefined(correction.categoryId),
      incomeTemplateId: emptyToUndefined(correction.incomeTemplateId),
      savingsGoalId: emptyToUndefined(correction.savingsGoalId),
      note: emptyToUndefined(correction.note),
    },
    dependencies.services,
  );

  await dependencies.repository.saveActivePlan(updatedPlan);

  return {
    plan: updatedPlan,
    result: calculateSafeToSpend({
      plan: updatedPlan,
      today: dependencies.today,
    }),
  };
}

export async function deleteDailyActivity(
  plan: BudgetPlan,
  deletion: DailyActivityDeletion,
  dependencies: DailyActionDependencies,
): Promise<DailyActionCompletion> {
  const updatedPlan = deleteFinancialEvent(
    plan,
    {
      id: deletion.id,
    },
    dependencies.services,
  );

  await dependencies.repository.saveActivePlan(updatedPlan);

  return {
    plan: updatedPlan,
    result: calculateSafeToSpend({
      plan: updatedPlan,
      today: dependencies.today,
    }),
  };
}

export async function undoLastDailyActivity(
  plan: BudgetPlan,
  dependencies: DailyActionDependencies,
): Promise<DailyActionCompletion> {
  const latestEvent = [...plan.financialEvents].sort(compareEventsNewestFirst)[0];

  if (latestEvent === undefined) {
    throw new RangeError("There is no recent activity to undo.");
  }

  return deleteDailyActivity(
    plan,
    {
      kind: "financial-event",
      id: latestEvent.id,
    },
    dependencies,
  );
}

function compareEventsNewestFirst(
  left: { date: DateOnly; createdAt: string },
  right: { date: DateOnly; createdAt: string },
): number {
  if (left.date !== right.date) {
    return right.date.localeCompare(left.date);
  }

  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function applyDailyAction(
  plan: BudgetPlan,
  action: DailyAction,
  services: ApplicationServices,
): BudgetPlan {
  if (action.kind === "log-spending") {
    return logSpending(
      plan,
      {
        amount: parseMoneyInput(action.amount, plan, "Spending amount"),
        categoryId: emptyToUndefined(action.categoryId),
        date: action.date,
        note: emptyToUndefined(action.note),
      },
      services,
    );
  }

  if (action.kind === "update-balance") {
    return recordBalanceSnapshot(
      plan,
      {
        amount: parseMoneyInput(action.amount, plan, "Current balance"),
        date: action.date,
        note: emptyToUndefined(action.note) ?? "Current balance update",
      },
      services,
    );
  }

  if (action.kind === "confirm-income") {
    return confirmIncomeReceived(
      plan,
      {
        amount: parseMoneyInput(action.amount, plan, "Income amount"),
        date: action.date,
        incomeTemplateId: emptyToUndefined(action.incomeTemplateId),
        note: emptyToUndefined(action.note),
      },
      services,
    );
  }

  return recordSavingsContribution(
    plan,
    {
      amount: parseMoneyInput(action.amount, plan, "Savings contribution"),
      date: action.date,
      savingsGoalId: action.savingsGoalId,
      note: emptyToUndefined(action.note),
    },
    services,
  );
}

function parseMoneyInput(
  input: string,
  plan: BudgetPlan,
  fieldName: string,
): Money {
  const cleaned = input
    .trim()
    .replace(/,/g, "")
    .replace(plan.currency.symbol ?? "", "");

  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new RangeError(`${fieldName} must be a valid money amount.`);
  }

  const [whole = "0", fraction = ""] = cleaned.split(".");

  if (fraction.length > plan.currency.decimalPlaces) {
    throw new RangeError(
      `${fieldName} can include at most ${plan.currency.decimalPlaces} decimal places.`,
    );
  }

  return (
    Number(whole) * 10 ** plan.currency.decimalPlaces +
    Number(fraction.padEnd(plan.currency.decimalPlaces, "0"))
  );
}

function emptyToUndefined<T extends string>(value: T | undefined): T | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}
