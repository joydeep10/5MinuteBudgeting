export const budgetPlanSchemaVersion = 1 as const;

export type BudgetPlanSchemaVersion = typeof budgetPlanSchemaVersion;
export type EntityId = string;
export type Timestamp = string;
export type DateOnly = string;
export type MoneyMinorUnits = number;
export type Money = MoneyMinorUnits;

export interface CurrencyMetadata {
  code: string;
  decimalPlaces: number;
  symbol?: string;
}

export interface PersistedRecord {
  id: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type BudgetMode = "fixed-income" | "irregular-income" | "general";

export interface ActiveBudgetPeriod {
  startDate: DateOnly;
  endDate: DateOnly;
}

export type CategoryKind =
  | "commitment"
  | "flexible"
  | "income"
  | "savings"
  | "custom";

export interface Category extends PersistedRecord {
  name: string;
  kind: CategoryKind;
  archived: boolean;
}

export type RecurrenceFrequency =
  | "one-time"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly";

export interface WeeklyRecurrenceOptions {
  daysOfWeek?: readonly number[];
}

export type MissingDayBehavior = "last-valid-day";

export interface MonthlyRecurrenceOptions {
  dayOfMonth: number;
  missingDayBehavior: MissingDayBehavior;
}

export interface YearlyRecurrenceOptions {
  month: number;
  dayOfMonth: number;
  missingDayBehavior: MissingDayBehavior;
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  anchorDate: DateOnly;
  weekly?: WeeklyRecurrenceOptions;
  monthly?: MonthlyRecurrenceOptions;
  yearly?: YearlyRecurrenceOptions;
  endsOn?: DateOnly;
}

export interface RecurrenceOccurrence {
  id: string;
  templateId: EntityId;
  date: DateOnly;
}

export interface GenerateRecurrenceOccurrencesInput {
  templateId: EntityId;
  startsOn: DateOnly;
  endsOn?: DateOnly;
  recurrence: RecurrenceRule;
  period: ActiveBudgetPeriod;
}

export interface IncomeTemplate extends PersistedRecord {
  name: string;
  amount: Money;
  active: boolean;
  startsOn: DateOnly;
  endsOn?: DateOnly;
  recurrence: RecurrenceRule;
  includeInProjection: boolean;
  categoryId?: EntityId;
}

export type CommitmentKind = "bill" | "debt";

export interface CommitmentTemplate extends PersistedRecord {
  name: string;
  kind: CommitmentKind;
  amount: Money;
  active: boolean;
  startsOn: DateOnly;
  endsOn?: DateOnly;
  recurrence: RecurrenceRule;
  categoryId?: EntityId;
}

export type CommitmentOccurrenceTiming = "overdue" | "due-today" | "future";

export interface CommitmentAmountOverride extends PersistedRecord {
  commitmentTemplateId: EntityId;
  occurrenceDate: DateOnly;
  amount: Money;
}

export interface CommitmentOccurrence {
  id: string;
  templateId: EntityId;
  name: string;
  kind: CommitmentKind;
  date: DateOnly;
  amount: Money;
  paidAmount: Money;
  remainingUnpaidAmount: Money;
  paid: boolean;
  timing: CommitmentOccurrenceTiming;
}

export interface GenerateCommitmentOccurrencesInput {
  commitments: readonly CommitmentTemplate[];
  period: ActiveBudgetPeriod;
  today: DateOnly;
  financialEvents: readonly FinancialEventRecord[];
  amountOverrides: readonly CommitmentAmountOverride[];
}

export type SavingsGoalStatus = "active" | "paused" | "completed" | "archived";

export interface SavingsGoal extends PersistedRecord {
  name: string;
  targetAmount: Money;
  currentAmount: Money;
  targetDate?: DateOnly;
  status: SavingsGoalStatus;
  protected: boolean;
  priority?: number;
  periodContributionOverride?: Money;
}

export interface FlexibleCategoryGuidance extends PersistedRecord {
  categoryId: EntityId;
  periodLimit: Money;
  reserved: boolean;
}

export interface PlannedRecords {
  categories: readonly Category[];
  incomeTemplates: readonly IncomeTemplate[];
  commitmentTemplates: readonly CommitmentTemplate[];
  savingsGoals: readonly SavingsGoal[];
  flexibleCategoryGuidance: readonly FlexibleCategoryGuidance[];
}

export interface BalanceSnapshot extends PersistedRecord {
  date: DateOnly;
  amount: Money;
  note?: string;
}

export type FinancialEventKind =
  | "spending"
  | "income-received"
  | "commitment-payment"
  | "savings-contribution"
  | "balance-adjustment";

export interface FinancialEventRecord extends PersistedRecord {
  date: DateOnly;
  kind: FinancialEventKind;
  amount: Money;
  categoryId?: EntityId;
  incomeTemplateId?: EntityId;
  commitmentTemplateId?: EntityId;
  occurrenceDate?: DateOnly;
  savingsGoalId?: EntityId;
  note?: string;
}

export interface BudgetPlan extends PersistedRecord {
  schemaVersion: BudgetPlanSchemaVersion;
  mode: BudgetMode;
  currency: CurrencyMetadata;
  activePeriod: ActiveBudgetPeriod;
  fixedBuffer: Money;
  plannedRecords: PlannedRecords;
  balanceSnapshots: readonly BalanceSnapshot[];
  financialEvents: readonly FinancialEventRecord[];
}

export function parseDateOnly(date: DateOnly): Date {
  const [year, month, day] = date.split("-").map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid date-only value: ${date}`);
  }

  return new Date(year, month - 1, day);
}

export function formatDateOnly(date: Date): DateOnly {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function inclusiveDaysRemaining(
  fromDate: DateOnly,
  throughDate: DateOnly,
): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const from = parseDateOnly(fromDate);
  const through = parseDateOnly(throughDate);
  const calendarDays =
    Math.round((through.getTime() - from.getTime()) / millisecondsPerDay) + 1;

  return Math.max(1, calendarDays);
}

export function generateRecurrenceOccurrences({
  templateId,
  startsOn,
  endsOn,
  recurrence,
  period,
}: GenerateRecurrenceOccurrencesInput): RecurrenceOccurrence[] {
  const effectiveEndDate = earlierDateOnly(period.endDate, endsOn);

  if (recurrence.frequency === "one-time") {
    if (
      compareDateOnly(startsOn, period.startDate) < 0 ||
      compareDateOnly(startsOn, effectiveEndDate) > 0
    ) {
      return [];
    }

    return [createOccurrence(templateId, startsOn)];
  }

  if (recurrence.frequency === "weekly") {
    const weekdays = recurrence.weekly?.daysOfWeek ?? [
      parseDateOnly(startsOn).getDay(),
    ];

    return generateDailyCandidates({
      templateId,
      startsOn,
      period,
      effectiveEndDate,
      shouldInclude: (candidate) =>
        weekdays.includes(candidate.getDay()) &&
        weeksBetween(startsOn, formatDateOnly(candidate)) %
          recurrence.interval ===
          0,
    });
  }

  if (recurrence.frequency === "biweekly") {
    return generateDailyCandidates({
      templateId,
      startsOn,
      period,
      effectiveEndDate,
      shouldInclude: (candidate) =>
        daysBetween(startsOn, formatDateOnly(candidate)) %
          (14 * recurrence.interval) ===
        0,
    });
  }

  if (recurrence.frequency === "monthly") {
    const dayOfMonth =
      recurrence.monthly?.dayOfMonth ?? parseDateOnly(startsOn).getDate();

    return generateDailyCandidates({
      templateId,
      startsOn,
      period,
      effectiveEndDate,
      shouldInclude: (candidate) => {
        const candidateDate = formatDateOnly(candidate);
        const expectedDay = Math.min(
          dayOfMonth,
          lastDayOfMonth(candidate.getFullYear(), candidate.getMonth()),
        );

        return (
          candidate.getDate() === expectedDay &&
          monthsBetween(startsOn, candidateDate) % recurrence.interval === 0
        );
      },
    });
  }

  if (recurrence.frequency === "yearly") {
    const startDate = parseDateOnly(startsOn);
    const recurrenceMonth = recurrence.yearly?.month ?? startDate.getMonth() + 1;
    const dayOfMonth = recurrence.yearly?.dayOfMonth ?? startDate.getDate();

    return generateDailyCandidates({
      templateId,
      startsOn,
      period,
      effectiveEndDate,
      shouldInclude: (candidate) => {
        const candidateDate = formatDateOnly(candidate);
        const expectedDay = Math.min(
          dayOfMonth,
          lastDayOfMonth(candidate.getFullYear(), recurrenceMonth - 1),
        );

        return (
          candidate.getMonth() + 1 === recurrenceMonth &&
          candidate.getDate() === expectedDay &&
          yearsBetween(startsOn, candidateDate) % recurrence.interval === 0
        );
      },
    });
  }

  return [];
}

export function generateCommitmentOccurrences({
  commitments,
  period,
  today,
  financialEvents,
  amountOverrides,
}: GenerateCommitmentOccurrencesInput): CommitmentOccurrence[] {
  return commitments
    .filter((commitment) => commitment.active)
    .flatMap((commitment) =>
      generateRecurrenceOccurrences({
        templateId: commitment.id,
        startsOn: commitment.startsOn,
        endsOn: commitment.endsOn,
        recurrence: commitment.recurrence,
        period,
      }).map((occurrence) => {
        const amount = commitmentOccurrenceAmount(
          commitment,
          occurrence.date,
          amountOverrides,
        );
        const paidAmount = commitmentOccurrencePaidAmount(
          commitment.id,
          occurrence.date,
          financialEvents,
        );
        const remainingUnpaidAmount = Math.max(0, amount - paidAmount);

        return {
          id: occurrence.id,
          templateId: commitment.id,
          name: commitment.name,
          kind: commitment.kind,
          date: occurrence.date,
          amount,
          paidAmount,
          remainingUnpaidAmount,
          paid: remainingUnpaidAmount <= 0,
          timing: commitmentOccurrenceTiming(occurrence.date, today),
        };
      }),
    )
    .sort((left, right) => compareDateOnly(left.date, right.date));
}

export function unpaidCommitmentDeduction(
  occurrences: readonly CommitmentOccurrence[],
): Money {
  return occurrences.reduce(
    (total, occurrence) => total + occurrence.remainingUnpaidAmount,
    0,
  );
}

function createOccurrence(
  templateId: EntityId,
  date: DateOnly,
): RecurrenceOccurrence {
  return {
    id: `${templateId}:${date}`,
    templateId,
    date,
  };
}

function compareDateOnly(left: DateOnly, right: DateOnly): number {
  return parseDateOnly(left).getTime() - parseDateOnly(right).getTime();
}

function commitmentOccurrenceTiming(
  occurrenceDate: DateOnly,
  today: DateOnly,
): CommitmentOccurrenceTiming {
  const comparison = compareDateOnly(occurrenceDate, today);

  if (comparison < 0) {
    return "overdue";
  }

  if (comparison === 0) {
    return "due-today";
  }

  return "future";
}

function commitmentOccurrenceAmount(
  commitment: CommitmentTemplate,
  occurrenceDate: DateOnly,
  amountOverrides: readonly CommitmentAmountOverride[],
): Money {
  return (
    amountOverrides.find(
      (override) =>
        override.commitmentTemplateId === commitment.id &&
        override.occurrenceDate === occurrenceDate,
    )?.amount ?? commitment.amount
  );
}

function commitmentOccurrencePaidAmount(
  commitmentTemplateId: EntityId,
  occurrenceDate: DateOnly,
  financialEvents: readonly FinancialEventRecord[],
): Money {
  return financialEvents
    .filter(
      (event) =>
        event.kind === "commitment-payment" &&
        event.commitmentTemplateId === commitmentTemplateId &&
        event.occurrenceDate === occurrenceDate,
    )
    .reduce((total, event) => total + event.amount, 0);
}

function earlierDateOnly(left: DateOnly, right?: DateOnly): DateOnly {
  if (right === undefined) {
    return left;
  }

  return compareDateOnly(left, right) <= 0 ? left : right;
}

function generateDailyCandidates({
  templateId,
  startsOn,
  period,
  effectiveEndDate,
  shouldInclude,
}: {
  templateId: EntityId;
  startsOn: DateOnly;
  period: ActiveBudgetPeriod;
  effectiveEndDate: DateOnly;
  shouldInclude: (candidate: Date) => boolean;
}): RecurrenceOccurrence[] {
  const occurrences: RecurrenceOccurrence[] = [];
  let cursor = parseDateOnly(laterDateOnly(startsOn, period.startDate));

  while (compareDateOnly(formatDateOnly(cursor), effectiveEndDate) <= 0) {
    if (shouldInclude(cursor)) {
      occurrences.push(createOccurrence(templateId, formatDateOnly(cursor)));
    }

    cursor = addDays(cursor, 1);
  }

  return occurrences;
}

function laterDateOnly(left: DateOnly, right: DateOnly): DateOnly {
  return compareDateOnly(left, right) >= 0 ? left : right;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function weeksBetween(start: DateOnly, end: DateOnly): number {
  return Math.floor(daysBetween(start, end) / 7);
}

function daysBetween(start: DateOnly, end: DateOnly): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round(
    (parseDateOnly(end).getTime() - parseDateOnly(start).getTime()) /
      millisecondsPerDay,
  );
}

function monthsBetween(start: DateOnly, end: DateOnly): number {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);

  return (
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    endDate.getMonth() -
    startDate.getMonth()
  );
}

function lastDayOfMonth(year: number, zeroBasedMonth: number): number {
  return new Date(year, zeroBasedMonth + 1, 0).getDate();
}

function yearsBetween(start: DateOnly, end: DateOnly): number {
  return parseDateOnly(end).getFullYear() - parseDateOnly(start).getFullYear();
}
