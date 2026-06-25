import { createBudgetPlan } from "../application";
import type { ApplicationServices, CommitmentTemplateDraft } from "../application";
import { calculateSafeToSpend } from "../domain";
import type {
  BudgetMode,
  BudgetPlan,
  CurrencyMetadata,
  DateOnly,
  Money,
  SafeToSpendResult,
} from "../domain";
import type { BudgetPlanRepository } from "../infrastructure";

export type CommitmentShortcut =
  | "Rent"
  | "EMI"
  | "Utilities"
  | "Subscriptions"
  | "Custom";

export interface SetupCommitmentAnswer {
  shortcut: CommitmentShortcut;
  amount: string;
  dueDate: DateOnly;
  name?: string;
}

export interface SetupWizardSubmission {
  currencyCode: string;
  currentUsableBalance: string;
  mode: BudgetMode;
  periodStartDate: DateOnly;
  periodEndDate?: DateOnly;
  nextPayday?: DateOnly;
  commitments: readonly SetupCommitmentAnswer[];
  safetyBuffer: string;
}

export interface CompleteSetupWizardDependencies {
  repository: BudgetPlanRepository;
  services: ApplicationServices;
  today: DateOnly;
}

export interface SetupWizardCompletion {
  plan: BudgetPlan;
  result: SafeToSpendResult;
}

export interface EstimateSetupWizardInput {
  submission: Partial<SetupWizardSubmission>;
  today: DateOnly;
}

const supportedCurrencies: Record<string, CurrencyMetadata> = {
  USD: {
    code: "USD",
    decimalPlaces: 2,
    symbol: "$",
  },
  INR: {
    code: "INR",
    decimalPlaces: 2,
    symbol: "Rs",
  },
  GBP: {
    code: "GBP",
    decimalPlaces: 2,
    symbol: "GBP",
  },
  EUR: {
    code: "EUR",
    decimalPlaces: 2,
    symbol: "EUR",
  },
};

export async function completeSetupWizard(
  submission: SetupWizardSubmission,
  dependencies: CompleteSetupWizardDependencies,
): Promise<SetupWizardCompletion> {
  const plan = buildBudgetPlanFromSetup(submission, dependencies.services);

  await dependencies.repository.saveActivePlan(plan);

  return {
    plan,
    result: calculateSafeToSpend({
      plan,
      today: dependencies.today,
    }),
  };
}

export function estimateSetupWizardResult({
  submission,
  today,
}: EstimateSetupWizardInput): SetupWizardCompletion | undefined {
  if (!hasEnoughAnswersForEstimate(submission)) {
    return undefined;
  }

  try {
    const plan = buildBudgetPlanFromSetup(submission, {
      generateId: (prefix) => `${prefix}_estimate`,
      now: () => "estimate",
    });

    return {
      plan,
      result: calculateSafeToSpend({
        plan,
        today,
      }),
    };
  } catch {
    return undefined;
  }
}

export function buildBudgetPlanFromSetup(
  submission: SetupWizardSubmission,
  services: ApplicationServices,
): BudgetPlan {
  const currency = currencyForCode(submission.currencyCode);
  const activePeriod = activePeriodFromSetup(submission);
  const startingAvailableMoney = parseMoneyInput(
    submission.currentUsableBalance,
    currency,
    "Current usable balance",
  );
  const fixedBuffer = parseMoneyInput(
    submission.safetyBuffer,
    currency,
    "Safety buffer",
  );

  return createBudgetPlan(
    {
      mode: submission.mode,
      currency,
      activePeriod,
      fixedBuffer,
      startingAvailableMoney,
      initialCommitmentTemplates: submission.commitments.map((commitment) =>
        commitmentTemplateFromSetup(commitment, currency),
      ),
    },
    services,
  );
}

export function formatMoney(amount: Money, currency: CurrencyMetadata): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
  }).format(amount / 10 ** currency.decimalPlaces);
}

function currencyForCode(code: string): CurrencyMetadata {
  const currency = supportedCurrencies[code.toUpperCase()];

  if (currency === undefined) {
    throw new RangeError("Choose one of the supported currencies.");
  }

  return { ...currency };
}

function hasEnoughAnswersForEstimate(
  submission: Partial<SetupWizardSubmission>,
): submission is SetupWizardSubmission {
  if (
    typeof submission.currencyCode !== "string" ||
    typeof submission.currentUsableBalance !== "string" ||
    !isBudgetMode(submission.mode) ||
    typeof submission.periodStartDate !== "string" ||
    typeof submission.safetyBuffer !== "string" ||
    !Array.isArray(submission.commitments)
  ) {
    return false;
  }

  return submission.mode === "fixed-income"
    ? typeof submission.nextPayday === "string" ||
        typeof submission.periodEndDate === "string"
    : typeof submission.periodEndDate === "string" ||
        typeof submission.nextPayday === "string";
}

function isBudgetMode(value: unknown): value is BudgetMode {
  return value === "fixed-income" || value === "irregular-income" || value === "general";
}

function activePeriodFromSetup(
  submission: SetupWizardSubmission,
): { startDate: DateOnly; endDate: DateOnly } {
  const endDate =
    submission.mode === "fixed-income"
      ? submission.nextPayday ?? submission.periodEndDate
      : submission.periodEndDate ?? submission.nextPayday;

  if (submission.periodStartDate === "") {
    throw new RangeError("Choose when this budget starts.");
  }

  if (endDate === undefined || endDate === "") {
    throw new RangeError(
      submission.mode === "fixed-income"
        ? "Add your next payday."
        : "Choose when this budget period ends.",
    );
  }

  if (endDate < submission.periodStartDate) {
    throw new RangeError("The budget period must end on or after it starts.");
  }

  return {
    startDate: submission.periodStartDate,
    endDate,
  };
}

function parseMoneyInput(
  input: string,
  currency: CurrencyMetadata,
  fieldName: string,
): Money {
  const cleaned = input.trim().replace(/,/g, "").replace(currency.symbol ?? "", "");

  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new RangeError(`${fieldName} must be a valid money amount.`);
  }

  const [whole = "0", fraction = ""] = cleaned.split(".");

  if (fraction.length > currency.decimalPlaces) {
    throw new RangeError(
      `${fieldName} can include at most ${currency.decimalPlaces} decimal places.`,
    );
  }

  return (
    Number(whole) * 10 ** currency.decimalPlaces +
    Number(fraction.padEnd(currency.decimalPlaces, "0"))
  );
}

function commitmentTemplateFromSetup(
  commitment: SetupCommitmentAnswer,
  currency: CurrencyMetadata,
): CommitmentTemplateDraft {
  if (commitment.dueDate === "") {
    throw new RangeError("Choose when each commitment is due.");
  }

  const name =
    commitment.shortcut === "Custom"
      ? commitment.name?.trim() || "Custom commitment"
      : commitment.shortcut;

  return {
    name,
    kind: commitment.shortcut === "EMI" ? "debt" : "bill",
    amount: parseMoneyInput(commitment.amount, currency, `${name} amount`),
    active: true,
    startsOn: commitment.dueDate,
    recurrence: {
      frequency: "one-time",
      interval: 1,
      anchorDate: commitment.dueDate,
    },
  };
}
