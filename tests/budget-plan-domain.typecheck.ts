import { budgetPlanSchemaVersion } from "../src/domain";
import type {
  BudgetPlan,
  CommitmentTemplate,
  CurrencyMetadata,
  DateOnly,
  Money,
  Timestamp,
} from "../src/domain";

const money = (minorUnits: number): Money => minorUnits;
const dateOnly = (value: string): DateOnly => value;
const timestamp = (value: string): Timestamp => value;

const usd: CurrencyMetadata = {
  code: "USD",
  decimalPlaces: 2,
};

export const representativeBudgetPlan = {
  schemaVersion: budgetPlanSchemaVersion,
  id: "budget_typecheck",
  createdAt: timestamp("2026-06-19T08:00:00.000Z"),
  updatedAt: timestamp("2026-06-19T08:00:00.000Z"),
  budgetingStyle: "general-budget",
  incomeSchedule: { kind: "none" },
  carriedForwardMoney: { amount: money(0) },
  independentBufferTracker: {
    enabled: false,
    startingAmount: money(0),
    spendingRecords: [],
  },
  currency: usd,
  activePeriod: {
    startDate: dateOnly("2026-06-19"),
    endDate: dateOnly("2026-07-18"),
  },
  fixedBuffer: money(10_000),
  plannedRecords: {
    categories: [],
    incomeTemplates: [],
    commitmentTemplates: [],
    savingsGoals: [],
    flexibleCategoryGuidance: [],
  },
  balanceSnapshots: [],
  financialEvents: [],
} satisfies BudgetPlan;

export const commitmentWithPlanCurrencyOnly = {
  id: "commitment_typecheck",
  createdAt: timestamp("2026-06-19T08:00:00.000Z"),
  updatedAt: timestamp("2026-06-19T08:00:00.000Z"),
  name: "Internet",
  kind: "bill",
  amount: money(8_000),
  active: true,
  startsOn: dateOnly("2026-06-25"),
  recurrence: {
    frequency: "monthly",
    interval: 1,
    anchorDate: dateOnly("2026-06-25"),
  },
} satisfies CommitmentTemplate;

export const commitmentWithOwnCurrency = {
  id: "commitment_currency_error",
  createdAt: timestamp("2026-06-19T08:00:00.000Z"),
  updatedAt: timestamp("2026-06-19T08:00:00.000Z"),
  name: "Internet",
  kind: "bill",
  amount: money(8_000),
  active: true,
  startsOn: dateOnly("2026-06-25"),
  recurrence: {
    frequency: "monthly",
    interval: 1,
    anchorDate: dateOnly("2026-06-25"),
  },
  // @ts-expect-error Records inherit the BudgetPlan currency.
  currency: usd,
} satisfies CommitmentTemplate;
