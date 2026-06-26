import {
  budgetPlanSchemaVersion,
  calculateEffectiveAvailableMoney,
  calculateSafeToSpend,
  formatDateOnly,
  generateCommitmentOccurrences,
  inclusiveDaysRemaining,
  parseDateOnly,
} from "../domain";
import type {
  ActiveBudgetPeriod,
  BalanceSnapshot,
  BudgetMode,
  BudgetPlan,
  Category,
  CategoryKind,
  CommitmentKind,
  CommitmentTemplate,
  CurrencyMetadata,
  DateOnly,
  EntityId,
  FinancialEventRecord,
  IncomeTemplate,
  Money,
  PeriodSnapshot,
  PlannedRecords,
  RecurrenceRule,
  SavingsGoal,
  SavingsGoalStatus,
  Timestamp,
} from "../domain";

export interface ApplicationServices {
  generateId: (prefix: string) => EntityId;
  now: () => Timestamp;
}

export interface CategoryDraft {
  name: string;
  kind: CategoryKind;
  archived?: boolean;
}

export interface IncomeTemplateDraft {
  name: string;
  amount: Money;
  active: boolean;
  startsOn: DateOnly;
  endsOn?: DateOnly;
  recurrence: RecurrenceRule;
  includeInProjection: boolean;
  categoryId?: EntityId;
}

export interface CommitmentTemplateDraft {
  name: string;
  kind: CommitmentKind;
  amount: Money;
  active: boolean;
  startsOn: DateOnly;
  endsOn?: DateOnly;
  recurrence: RecurrenceRule;
  categoryId?: EntityId;
}

export interface SavingsGoalDraft {
  name: string;
  targetAmount: Money;
  currentAmount: Money;
  targetDate?: DateOnly;
  status: SavingsGoalStatus;
  protected: boolean;
  priority?: number;
  periodContributionOverride?: Money;
}

export interface CreateBudgetPlanInput {
  mode: BudgetMode;
  currency: CurrencyMetadata;
  activePeriod: ActiveBudgetPeriod;
  fixedBuffer: Money;
  startingAvailableMoney: Money;
  defaultCategories?: readonly CategoryDraft[];
  initialIncomeTemplates?: readonly IncomeTemplateDraft[];
  initialCommitmentTemplates?: readonly CommitmentTemplateDraft[];
  initialSavingsGoals?: readonly SavingsGoalDraft[];
}

export interface RecordBalanceSnapshotInput {
  date: string;
  amount: Money;
  note?: string;
}

export interface LogSpendingInput {
  date: DateOnly;
  amount: Money;
  categoryId?: EntityId;
  note?: string;
}

export interface MarkCommitmentPaidInput {
  date: DateOnly;
  commitmentTemplateId: EntityId;
  occurrenceDate: DateOnly;
  amount?: Money;
  note?: string;
}

export interface ConfirmIncomeReceivedInput {
  date: DateOnly;
  amount: Money;
  incomeTemplateId?: EntityId;
  note?: string;
}

export interface RecordSavingsContributionInput {
  date: DateOnly;
  amount: Money;
  savingsGoalId: EntityId;
  note?: string;
}

export interface CorrectFinancialEventInput {
  id: EntityId;
  date?: DateOnly;
  amount?: Money;
  categoryId?: EntityId;
  incomeTemplateId?: EntityId;
  savingsGoalId?: EntityId;
  note?: string;
}

export interface DeleteFinancialEventInput {
  id: EntityId;
}

export interface RollBudgetPlanPeriodForwardInput {
  newActivePeriod: ActiveBudgetPeriod;
  confirmedAvailableMoney: Money;
  note?: string;
}

export function createBudgetPlan(
  input: CreateBudgetPlanInput,
  services: ApplicationServices,
): BudgetPlan {
  const timestamp = services.now();
  const planId = services.generateId("budget");
  const categories = (input.defaultCategories ?? []).map((category) =>
    createCategory(category, timestamp, services),
  );
  const incomeTemplates = (input.initialIncomeTemplates ?? []).map((template) =>
    createIncomeTemplate(template, timestamp, services),
  );
  const commitmentTemplates = (input.initialCommitmentTemplates ?? []).map(
    (template) => createCommitmentTemplate(template, timestamp, services),
  );
  const savingsGoals = (input.initialSavingsGoals ?? []).map((goal) =>
    createSavingsGoal(goal, timestamp, services),
  );

  return {
    schemaVersion: budgetPlanSchemaVersion,
    id: planId,
    createdAt: timestamp,
    updatedAt: timestamp,
    mode: input.mode,
    currency: { ...input.currency },
    activePeriod: { ...input.activePeriod },
    fixedBuffer: input.fixedBuffer,
    plannedRecords: {
      categories,
      incomeTemplates,
      commitmentTemplates,
      savingsGoals,
      flexibleCategoryGuidance: [],
    },
    balanceSnapshots: [
      {
        id: services.generateId("balance-snapshot"),
        createdAt: timestamp,
        updatedAt: timestamp,
        date: input.activePeriod.startDate,
        amount: input.startingAvailableMoney,
        note: "Opening balance",
      },
    ],
    financialEvents: [],
  };
}

export function recordBalanceSnapshot(
  plan: BudgetPlan,
  input: RecordBalanceSnapshotInput,
  services: ApplicationServices,
): BudgetPlan {
  assertDateInsideActivePeriod(input.date, plan.activePeriod);
  const timestamp = services.now();
  const snapshot: BalanceSnapshot = {
    id: services.generateId("balance-snapshot"),
    createdAt: timestamp,
    updatedAt: timestamp,
    date: input.date,
    amount: input.amount,
    note: input.note,
  };

  return updatePlan(plan, timestamp, {
    balanceSnapshots: [...plan.balanceSnapshots, snapshot],
  });
}

export function logSpending(
  plan: BudgetPlan,
  input: LogSpendingInput,
  services: ApplicationServices,
): BudgetPlan {
  assertDateInsideActivePeriod(input.date, plan.activePeriod);
  const timestamp = services.now();
  const event: FinancialEventRecord = {
    id: services.generateId("financial-event"),
    createdAt: timestamp,
    updatedAt: timestamp,
    date: input.date,
    kind: "spending",
    amount: input.amount,
    categoryId: input.categoryId,
    note: input.note,
  };

  return updatePlan(plan, timestamp, {
    financialEvents: appendFinancialEvent(plan, event),
  });
}

export function markCommitmentPaid(
  plan: BudgetPlan,
  input: MarkCommitmentPaidInput,
  services: ApplicationServices,
): BudgetPlan {
  assertDateInsideActivePeriod(input.date, plan.activePeriod);
  const timestamp = services.now();
  const amount =
    input.amount ??
    remainingCommitmentAmount(
      plan,
      input.commitmentTemplateId,
      input.occurrenceDate,
      input.date,
    );
  const event: FinancialEventRecord = {
    id: services.generateId("financial-event"),
    createdAt: timestamp,
    updatedAt: timestamp,
    date: input.date,
    kind: "commitment-payment",
    amount,
    commitmentTemplateId: input.commitmentTemplateId,
    occurrenceDate: input.occurrenceDate,
    note: input.note,
  };

  return updatePlan(plan, timestamp, {
    financialEvents: appendFinancialEvent(plan, event),
  });
}

export function confirmIncomeReceived(
  plan: BudgetPlan,
  input: ConfirmIncomeReceivedInput,
  services: ApplicationServices,
): BudgetPlan {
  assertDateInsideActivePeriod(input.date, plan.activePeriod);
  const timestamp = services.now();
  const event: FinancialEventRecord = {
    id: services.generateId("financial-event"),
    createdAt: timestamp,
    updatedAt: timestamp,
    date: input.date,
    kind: "income-received",
    amount: input.amount,
    incomeTemplateId: input.incomeTemplateId,
    note: input.note,
  };

  return updatePlan(plan, timestamp, {
    financialEvents: appendFinancialEvent(plan, event),
  });
}

export function recordSavingsContribution(
  plan: BudgetPlan,
  input: RecordSavingsContributionInput,
  services: ApplicationServices,
): BudgetPlan {
  assertDateInsideActivePeriod(input.date, plan.activePeriod);
  const timestamp = services.now();
  const event: FinancialEventRecord = {
    id: services.generateId("financial-event"),
    createdAt: timestamp,
    updatedAt: timestamp,
    date: input.date,
    kind: "savings-contribution",
    amount: input.amount,
    savingsGoalId: input.savingsGoalId,
    note: input.note,
  };

  return updatePlan(plan, timestamp, {
    financialEvents: appendFinancialEvent(plan, event),
  });
}

export function correctFinancialEvent(
  plan: BudgetPlan,
  input: CorrectFinancialEventInput,
  services: ApplicationServices,
): BudgetPlan {
  const existing = plan.financialEvents.find((event) => event.id === input.id);

  if (existing === undefined) {
    throw new RangeError(`Financial event ${input.id} was not found.`);
  }

  const date = input.date ?? existing.date;

  assertDateInsideActivePeriod(date, plan.activePeriod);

  const timestamp = services.now();

  return updatePlan(plan, timestamp, {
    financialEvents: plan.financialEvents.map((event) =>
      event.id === input.id
        ? {
            ...event,
            updatedAt: timestamp,
            date,
            amount: input.amount ?? event.amount,
            categoryId: input.categoryId ?? event.categoryId,
            incomeTemplateId: input.incomeTemplateId ?? event.incomeTemplateId,
            savingsGoalId: input.savingsGoalId ?? event.savingsGoalId,
            note: input.note ?? event.note,
          }
        : event,
    ),
  });
}

export function deleteFinancialEvent(
  plan: BudgetPlan,
  input: DeleteFinancialEventInput,
  services: ApplicationServices,
): BudgetPlan {
  if (!plan.financialEvents.some((event) => event.id === input.id)) {
    throw new RangeError(`Financial event ${input.id} was not found.`);
  }

  return updatePlan(plan, services.now(), {
    financialEvents: plan.financialEvents.filter(
      (event) => event.id !== input.id,
    ),
  });
}

export function suggestNextActivePeriod(plan: BudgetPlan): ActiveBudgetPeriod {
  const periodLength = inclusiveDaysRemaining(
    plan.activePeriod.startDate,
    plan.activePeriod.endDate,
  );
  const startDate = addDaysToDateOnly(plan.activePeriod.endDate, 1);

  return {
    startDate,
    endDate: addDaysToDateOnly(startDate, periodLength - 1),
  };
}

export function rollBudgetPlanPeriodForward(
  plan: BudgetPlan,
  input: RollBudgetPlanPeriodForwardInput,
  services: ApplicationServices,
): BudgetPlan {
  if (input.newActivePeriod.endDate < input.newActivePeriod.startDate) {
    throw new RangeError("The new active period must end on or after its start date.");
  }

  if (input.newActivePeriod.startDate <= plan.activePeriod.endDate) {
    throw new RangeError("The new active period must start after the current active period.");
  }

  if (!Number.isFinite(input.confirmedAvailableMoney)) {
    throw new RangeError("Roll-forward requires a valid confirmed available money amount.");
  }

  const timestamp = services.now();
  const periodSnapshot = buildPeriodSnapshot(plan, timestamp, services);
  const newOpeningSnapshot: BalanceSnapshot = {
    id: services.generateId("balance-snapshot"),
    createdAt: timestamp,
    updatedAt: timestamp,
    date: input.newActivePeriod.startDate,
    amount: input.confirmedAvailableMoney,
    note: input.note ?? "Roll-forward opening balance",
  };

  return {
    ...plan,
    updatedAt: timestamp,
    activePeriod: { ...input.newActivePeriod },
    currency: { ...plan.currency },
    plannedRecords: carryForwardPlannedRecords(plan, timestamp),
    balanceSnapshots: [...plan.balanceSnapshots, newOpeningSnapshot],
    financialEvents: [...plan.financialEvents],
    periodSnapshots: [...(plan.periodSnapshots ?? []), periodSnapshot],
  };
}

function createCategory(
  draft: CategoryDraft,
  timestamp: Timestamp,
  services: ApplicationServices,
): Category {
  return {
    id: services.generateId("category"),
    createdAt: timestamp,
    updatedAt: timestamp,
    name: draft.name,
    kind: draft.kind,
    archived: draft.archived ?? false,
  };
}

function createIncomeTemplate(
  draft: IncomeTemplateDraft,
  timestamp: Timestamp,
  services: ApplicationServices,
): IncomeTemplate {
  return {
    id: services.generateId("income-template"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...draft,
    recurrence: { ...draft.recurrence },
  };
}

function createCommitmentTemplate(
  draft: CommitmentTemplateDraft,
  timestamp: Timestamp,
  services: ApplicationServices,
): CommitmentTemplate {
  return {
    id: services.generateId("commitment-template"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...draft,
    recurrence: { ...draft.recurrence },
  };
}

function createSavingsGoal(
  draft: SavingsGoalDraft,
  timestamp: Timestamp,
  services: ApplicationServices,
): SavingsGoal {
  return {
    id: services.generateId("savings-goal"),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...draft,
  };
}

function updatePlan(
  plan: BudgetPlan,
  timestamp: Timestamp,
  updates: Partial<Pick<BudgetPlan, "balanceSnapshots" | "financialEvents">>,
): BudgetPlan {
  return {
    ...plan,
    updatedAt: timestamp,
    activePeriod: { ...plan.activePeriod },
    currency: { ...plan.currency },
    plannedRecords: {
      categories: [...plan.plannedRecords.categories],
      incomeTemplates: [...plan.plannedRecords.incomeTemplates],
      commitmentTemplates: [...plan.plannedRecords.commitmentTemplates],
      savingsGoals: [...plan.plannedRecords.savingsGoals],
      flexibleCategoryGuidance: [
        ...plan.plannedRecords.flexibleCategoryGuidance,
      ],
    },
    balanceSnapshots: updates.balanceSnapshots ?? [...plan.balanceSnapshots],
    financialEvents: updates.financialEvents ?? [...plan.financialEvents],
    periodSnapshots: plan.periodSnapshots === undefined ? undefined : [...plan.periodSnapshots],
  };
}

function assertDateInsideActivePeriod(
  date: DateOnly,
  period: ActiveBudgetPeriod,
): void {
  if (date < period.startDate || date > period.endDate) {
    throw new RangeError(
      `Date ${date} must be inside the active period ${period.startDate} to ${period.endDate}.`,
    );
  }
}

function appendFinancialEvent(
  plan: BudgetPlan,
  event: FinancialEventRecord,
): FinancialEventRecord[] {
  return [...plan.financialEvents, event];
}

function remainingCommitmentAmount(
  plan: BudgetPlan,
  commitmentTemplateId: EntityId,
  occurrenceDate: DateOnly,
  today: DateOnly,
): Money {
  const occurrence = generateCommitmentOccurrences({
    commitments: plan.plannedRecords.commitmentTemplates,
    period: plan.activePeriod,
    today,
    financialEvents: plan.financialEvents,
    amountOverrides: [],
  }).find(
    (candidate) =>
      candidate.templateId === commitmentTemplateId &&
      candidate.date === occurrenceDate,
  );

  if (occurrence === undefined) {
    throw new RangeError(
      `Commitment occurrence ${commitmentTemplateId} on ${occurrenceDate} was not found in the active period.`,
    );
  }

  return occurrence.remainingUnpaidAmount;
}

function buildPeriodSnapshot(
  plan: BudgetPlan,
  timestamp: Timestamp,
  services: ApplicationServices,
): PeriodSnapshot {
  return {
    id: services.generateId("period-snapshot"),
    createdAt: timestamp,
    updatedAt: timestamp,
    period: { ...plan.activePeriod },
    startingAvailableMoney: startingAvailableMoneyForPeriod(plan),
    endingEffectiveAvailableMoney: calculateEffectiveAvailableMoney(plan),
    totalSpending: totalEventsForKind(plan, "spending"),
    totalCommitmentsPaid: totalEventsForKind(plan, "commitment-payment"),
    totalSavingsContributions: totalEventsForKind(plan, "savings-contribution"),
    finalHealthStatus: calculateSafeToSpend({
      plan,
      today: plan.activePeriod.endDate,
    }).health,
  };
}

function startingAvailableMoneyForPeriod(plan: BudgetPlan): Money {
  return [...plan.balanceSnapshots]
    .filter((snapshot) => dateIsInsidePeriod(snapshot.date, plan.activePeriod))
    .sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }

      return Date.parse(left.createdAt) - Date.parse(right.createdAt);
    })[0]?.amount ?? 0;
}

function totalEventsForKind(
  plan: BudgetPlan,
  kind: FinancialEventRecord["kind"],
): Money {
  return plan.financialEvents
    .filter((event) => event.kind === kind)
    .filter((event) => dateIsInsidePeriod(event.date, plan.activePeriod))
    .reduce((total, event) => total + event.amount, 0);
}

function carryForwardPlannedRecords(
  plan: BudgetPlan,
  timestamp: Timestamp,
): PlannedRecords {
  return {
    categories: [...plan.plannedRecords.categories],
    incomeTemplates: [...plan.plannedRecords.incomeTemplates],
    commitmentTemplates: [...plan.plannedRecords.commitmentTemplates],
    savingsGoals: plan.plannedRecords.savingsGoals.map((goal) => ({
      ...goal,
      currentAmount:
        goal.currentAmount + savingsContributionsForGoalInActivePeriod(plan, goal.id),
      updatedAt: timestamp,
    })),
    flexibleCategoryGuidance: [
      ...plan.plannedRecords.flexibleCategoryGuidance,
    ],
  };
}

function savingsContributionsForGoalInActivePeriod(
  plan: BudgetPlan,
  savingsGoalId: EntityId,
): Money {
  return plan.financialEvents
    .filter(
      (event) =>
        event.kind === "savings-contribution" &&
        event.savingsGoalId === savingsGoalId &&
        dateIsInsidePeriod(event.date, plan.activePeriod),
    )
    .reduce((total, event) => total + event.amount, 0);
}

function dateIsInsidePeriod(date: DateOnly, period: ActiveBudgetPeriod): boolean {
  return date >= period.startDate && date <= period.endDate;
}

function addDaysToDateOnly(date: DateOnly, days: number): DateOnly {
  const next = parseDateOnly(date);
  next.setDate(next.getDate() + days);

  return formatDateOnly(next);
}
