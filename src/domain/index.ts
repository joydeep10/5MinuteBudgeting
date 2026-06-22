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

export interface PeriodSnapshot extends PersistedRecord {
  period: ActiveBudgetPeriod;
  startingAvailableMoney: Money;
  endingEffectiveAvailableMoney: Money;
  totalSpending: Money;
  totalCommitmentsPaid: Money;
  totalSavingsContributions: Money;
  finalHealthStatus: BudgetHealthStatus;
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
  periodSnapshots?: readonly PeriodSnapshot[];
}

export interface SavingsGoalAllocation {
  goalId: EntityId;
  name: string;
  status: SavingsGoalStatus;
  protected: boolean;
  priority?: number;
  targetAmount: Money;
  currentAmount: Money;
  progressAmount: Money;
  remainingAmount: Money;
  suggestedPeriodContribution: Money;
  plannedPeriodContribution: Money;
  contributedThisPeriod: Money;
  remainingProtectedDeduction: Money;
  overdueIncomplete: boolean;
}

export interface CategorySummary {
  categoryId: EntityId;
  categoryName: string;
  categoryKind: CategoryKind;
  spentAmount: Money;
  periodLimit?: Money;
  reserved: boolean;
  remainingGuidanceAmount?: Money;
  overageAmount: Money;
  chartValue: Money;
}

export type BudgetHealthStatus = "safe" | "tight" | "risky" | "overspending";

export interface SafeToSpendMetrics {
  rawSafePool: Money;
  safeThisPeriod: Money;
  safeToday: Money;
  safeThisWeek: Money;
}

export interface SafeToSpendBreakdown {
  effectiveAvailableMoney: Money;
  unpaidCommitments: Money;
  protectedSavings: Money;
  fixedBuffer: Money;
  projectedIncome: Money;
}

export type BudgetWarningSeverity = "guidance" | "warning" | "critical";

export type BudgetWarningCode =
  | "critical-shortfall"
  | "overdue-commitment"
  | "commitment-due-today"
  | "overdue-savings-goal"
  | "category-overage";

export interface BudgetWarning {
  id: string;
  severity: BudgetWarningSeverity;
  code: BudgetWarningCode;
  metadata: Record<string, unknown>;
}

export interface SafeToSpendResult {
  confirmed: SafeToSpendMetrics;
  projected: SafeToSpendMetrics;
  breakdown: SafeToSpendBreakdown;
  health: BudgetHealthStatus;
  warnings: readonly BudgetWarning[];
}

export interface CalculateSafeToSpendInput {
  plan: BudgetPlan;
  today: DateOnly;
  commitmentAmountOverrides?: readonly CommitmentAmountOverride[];
}

export interface OneTimeSpendScenario {
  kind: "one-time-spend";
  id: EntityId;
  date: DateOnly;
  amount: Money;
  categoryId?: EntityId;
  note?: string;
}

export interface AvailableMoneyAdjustmentScenario {
  kind: "available-money-adjustment";
  id: EntityId;
  date: DateOnly;
  amountDelta: Money;
  note?: string;
}

export interface CommitmentAddScenario {
  kind: "commitment-add";
  commitment: CommitmentTemplate;
}

export interface CommitmentRemoveScenario {
  kind: "commitment-remove";
  commitmentTemplateId: EntityId;
}

export interface CommitmentChangeScenario {
  kind: "commitment-change";
  commitmentTemplateId: EntityId;
  changes: Partial<
    Pick<
      CommitmentTemplate,
      "name" | "kind" | "amount" | "active" | "startsOn" | "endsOn" | "recurrence" | "categoryId"
    >
  >;
}

export interface BufferChangeScenario {
  kind: "buffer-change";
  fixedBuffer: Money;
}

export interface SavingsGoalChangeScenario {
  kind: "savings-goal-change";
  savingsGoalId: EntityId;
  status?: SavingsGoalStatus;
  protected?: boolean;
}

export type BudgetSimulationScenario =
  | OneTimeSpendScenario
  | AvailableMoneyAdjustmentScenario
  | CommitmentAddScenario
  | CommitmentRemoveScenario
  | CommitmentChangeScenario
  | BufferChangeScenario
  | SavingsGoalChangeScenario;

export interface BudgetSimulationDifference {
  rawSafePool: Money;
  safeThisPeriod: Money;
  safeToday: Money;
  safeThisWeek: Money;
  effectiveAvailableMoney: Money;
  unpaidCommitments: Money;
  protectedSavings: Money;
  fixedBuffer: Money;
  projectedIncome: Money;
}

export interface BudgetSimulationResult {
  current: SafeToSpendResult;
  simulated: SafeToSpendResult;
  difference: BudgetSimulationDifference;
}

export interface SimulateBudgetPlanInput {
  plan: BudgetPlan;
  today: DateOnly;
  scenarios: readonly BudgetSimulationScenario[];
}

export interface ExportSnapshotMetrics {
  confirmed: SafeToSpendMetrics;
  projected: SafeToSpendMetrics;
  health: BudgetHealthStatus;
  warnings: readonly BudgetWarning[];
}

export interface ExportSnapshotSummary {
  effectiveAvailableMoney: Money;
  unpaidCommitments: Money;
  protectedSavings: Money;
  fixedBuffer: Money;
  projectedIncome: Money;
}

export interface ExportLedgerRow {
  id: EntityId;
  date: DateOnly;
  rowType: "financial-event" | "commitment-occurrence";
  label: string;
  amount: Money;
  categoryId?: EntityId;
  relatedRecordId?: EntityId;
}

export interface ExportSnapshotReport {
  commitments: readonly CommitmentOccurrence[];
  spendingSummaries: readonly CategorySummary[];
  savingsSummaries: readonly SavingsGoalAllocation[];
  ledgerRows: readonly ExportLedgerRow[];
}

export interface CategorySpendingChartPoint {
  categoryId: EntityId;
  label: string;
  value: Money;
  limit?: Money;
  overageAmount: Money;
}

export interface CommitmentDateChartPoint {
  date: DateOnly;
  label: string;
  value: Money;
  remainingUnpaidAmount: Money;
}

export interface SavingsProgressChartPoint {
  goalId: EntityId;
  label: string;
  currentAmount: Money;
  targetAmount: Money;
  progressAmount: Money;
  remainingAmount: Money;
}

export interface BudgetRunwayChartPoint {
  label: "today" | "this-week" | "this-period";
  value: Money;
}

export interface HealthContextChartPoint {
  status: BudgetHealthStatus;
  rawSafePool: Money;
  shortfallAmount: Money;
}

export interface ExportSnapshotCharts {
  categorySpending: readonly CategorySpendingChartPoint[];
  commitmentsByDate: readonly CommitmentDateChartPoint[];
  savingsProgress: readonly SavingsProgressChartPoint[];
  budgetRunway: readonly BudgetRunwayChartPoint[];
  healthContext: readonly HealthContextChartPoint[];
}

export interface ExportSnapshot {
  planId: EntityId;
  asOfDate: DateOnly;
  activePeriod: ActiveBudgetPeriod;
  currency: CurrencyMetadata;
  metrics: ExportSnapshotMetrics;
  summary: ExportSnapshotSummary;
  report: ExportSnapshotReport;
  charts: ExportSnapshotCharts;
}

export interface BuildExportSnapshotInput {
  plan: BudgetPlan;
  today: DateOnly;
  calculation: SafeToSpendResult;
  commitmentOccurrences: readonly CommitmentOccurrence[];
  categorySummaries: readonly CategorySummary[];
  savingsGoalAllocations: readonly SavingsGoalAllocation[];
}

export function calculateEffectiveAvailableMoney(plan: BudgetPlan): Money {
  const latestSnapshot = latestBalanceSnapshot(plan.balanceSnapshots);
  const startingAmount = latestSnapshot?.amount ?? 0;
  const eventImpact = plan.financialEvents
    .filter((event) => dateOnlyIsInsidePeriod(event.date, plan.activePeriod))
    .filter((event) =>
      latestSnapshot === undefined ? true : eventHappenedAfterSnapshot(event, latestSnapshot),
    )
    .reduce((total, event) => total + effectiveAvailableMoneyEventImpact(event), 0);

  return startingAmount + eventImpact;
}

export function calculateSafeToSpend({
  plan,
  today,
  commitmentAmountOverrides = [],
}: CalculateSafeToSpendInput): SafeToSpendResult {
  const effectiveAvailableMoney = calculateEffectiveAvailableMoney(plan);
  const commitmentOccurrences = generateCommitmentOccurrences({
    commitments: plan.plannedRecords.commitmentTemplates,
    period: plan.activePeriod,
    today,
    financialEvents: plan.financialEvents,
    amountOverrides: commitmentAmountOverrides,
  });
  const unpaidCommitments = unpaidCommitmentDeduction(commitmentOccurrences);
  const savingsGoalAllocations = calculateSavingsGoalAllocations(plan);
  const protectedSavings = savingsGoalAllocations.reduce(
    (total, allocation) => total + allocation.remainingProtectedDeduction,
    0,
  );
  const rawSafePool =
    effectiveAvailableMoney -
    unpaidCommitments -
    protectedSavings -
    plan.fixedBuffer;
  const projectedIncome = projectedIncomeThroughPeriodEnd(plan, today);
  const confirmed = calculateSafeToSpendMetrics(
    rawSafePool,
    today,
    plan.activePeriod,
  );

  return {
    confirmed,
    projected: calculateSafeToSpendMetrics(
      rawSafePool + projectedIncome,
      today,
      plan.activePeriod,
    ),
    breakdown: {
      effectiveAvailableMoney,
      unpaidCommitments,
      protectedSavings,
      fixedBuffer: plan.fixedBuffer,
      projectedIncome,
    },
    health: budgetHealth(rawSafePool, effectiveAvailableMoney, plan.fixedBuffer),
    warnings: generateBudgetWarnings(
      plan,
      rawSafePool,
      commitmentOccurrences,
      savingsGoalAllocations,
      calculateCategorySummaries(plan),
    ),
  };
}

export function simulateBudgetPlan({
  plan,
  today,
  scenarios,
}: SimulateBudgetPlanInput): BudgetSimulationResult {
  const current = calculateSafeToSpend({ plan, today });
  const simulatedPlan = scenarios.reduce(
    (workingPlan, scenario) => applySimulationScenario(workingPlan, scenario),
    cloneBudgetPlan(plan),
  );
  const simulated = calculateSafeToSpend({ plan: simulatedPlan, today });

  return {
    current,
    simulated,
    difference: calculateSimulationDifference(current, simulated),
  };
}

export function buildExportSnapshot({
  plan,
  today,
  calculation,
  commitmentOccurrences,
  categorySummaries,
  savingsGoalAllocations,
}: BuildExportSnapshotInput): ExportSnapshot {
  return {
    planId: plan.id,
    asOfDate: today,
    activePeriod: { ...plan.activePeriod },
    currency: { ...plan.currency },
    metrics: {
      confirmed: calculation.confirmed,
      projected: calculation.projected,
      health: calculation.health,
      warnings: calculation.warnings,
    },
    summary: {
      effectiveAvailableMoney: calculation.breakdown.effectiveAvailableMoney,
      unpaidCommitments: calculation.breakdown.unpaidCommitments,
      protectedSavings: calculation.breakdown.protectedSavings,
      fixedBuffer: calculation.breakdown.fixedBuffer,
      projectedIncome: calculation.breakdown.projectedIncome,
    },
    report: {
      commitments: commitmentOccurrences,
      spendingSummaries: categorySummaries,
      savingsSummaries: savingsGoalAllocations,
      ledgerRows: [
        ...plan.financialEvents.map(financialEventLedgerRow),
        ...commitmentOccurrences.map(commitmentOccurrenceLedgerRow),
      ],
    },
    charts: {
      categorySpending: categorySummaries.map((summary) => ({
        categoryId: summary.categoryId,
        label: summary.categoryName,
        value: summary.spentAmount,
        limit: summary.periodLimit,
        overageAmount: summary.overageAmount,
      })),
      commitmentsByDate: commitmentOccurrences.map((occurrence) => ({
        date: occurrence.date,
        label: occurrence.name,
        value: occurrence.amount,
        remainingUnpaidAmount: occurrence.remainingUnpaidAmount,
      })),
      savingsProgress: savingsGoalAllocations.map((allocation) => ({
        goalId: allocation.goalId,
        label: allocation.name,
        currentAmount: allocation.currentAmount,
        targetAmount: allocation.targetAmount,
        progressAmount: allocation.progressAmount,
        remainingAmount: allocation.remainingAmount,
      })),
      budgetRunway: [
        {
          label: "today",
          value: calculation.confirmed.safeToday,
        },
        {
          label: "this-week",
          value: calculation.confirmed.safeThisWeek,
        },
        {
          label: "this-period",
          value: calculation.confirmed.safeThisPeriod,
        },
      ],
      healthContext: [
        {
          status: calculation.health,
          rawSafePool: calculation.confirmed.rawSafePool,
          shortfallAmount: Math.max(0, -calculation.confirmed.rawSafePool),
        },
      ],
    },
  };
}

export function calculateCategorySummaries(plan: BudgetPlan): CategorySummary[] {
  return plan.plannedRecords.categories
    .filter((category) => !category.archived)
    .map((category) => {
      const spentAmount = spendingForCategory(category.id, plan);
      const guidance = plan.plannedRecords.flexibleCategoryGuidance.find(
        (record) => record.categoryId === category.id,
      );
      const overageAmount =
        guidance === undefined ? 0 : Math.max(0, spentAmount - guidance.periodLimit);

      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryKind: category.kind,
        spentAmount,
        periodLimit: guidance?.periodLimit,
        reserved: guidance?.reserved ?? false,
        remainingGuidanceAmount:
          guidance === undefined
            ? undefined
            : Math.max(0, guidance.periodLimit - spentAmount),
        overageAmount,
        chartValue: spentAmount,
      };
    })
    .filter(
      (summary) =>
        summary.spentAmount > 0 || summary.periodLimit !== undefined,
    );
}

export function calculateSavingsGoalAllocations(
  plan: BudgetPlan,
): SavingsGoalAllocation[] {
  return plan.plannedRecords.savingsGoals.map((goal) => {
    const contributedThisPeriod = savingsContributionsForGoal(goal.id, plan);
    const progressAmount = goal.currentAmount + contributedThisPeriod;
    const remainingAmount = Math.max(0, goal.targetAmount - progressAmount);
    const suggestedPeriodContribution =
      goal.status === "active"
        ? suggestedSavingsContribution(goal, plan.activePeriod)
        : 0;
    const plannedPeriodContribution =
      goal.status === "active"
        ? goal.periodContributionOverride ?? suggestedPeriodContribution
        : 0;
    const remainingProtectedDeduction =
      goal.status === "active" && goal.protected
        ? Math.max(0, plannedPeriodContribution - contributedThisPeriod)
        : 0;

    return {
      goalId: goal.id,
      name: goal.name,
      status: goal.status,
      protected: goal.protected,
      priority: goal.priority,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      progressAmount,
      remainingAmount,
      suggestedPeriodContribution,
      plannedPeriodContribution,
      contributedThisPeriod,
      remainingProtectedDeduction,
      overdueIncomplete: savingsGoalIsOverdueIncomplete(
        goal,
        remainingAmount,
        plan.activePeriod,
      ),
    };
  });
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

function cloneBudgetPlan(plan: BudgetPlan): BudgetPlan {
  return {
    ...plan,
    currency: { ...plan.currency },
    activePeriod: { ...plan.activePeriod },
    plannedRecords: {
      categories: [...plan.plannedRecords.categories],
      incomeTemplates: [...plan.plannedRecords.incomeTemplates],
      commitmentTemplates: [...plan.plannedRecords.commitmentTemplates],
      savingsGoals: [...plan.plannedRecords.savingsGoals],
      flexibleCategoryGuidance: [
        ...plan.plannedRecords.flexibleCategoryGuidance,
      ],
    },
    balanceSnapshots: [...plan.balanceSnapshots],
    financialEvents: [...plan.financialEvents],
  };
}

function applySimulationScenario(
  plan: BudgetPlan,
  scenario: BudgetSimulationScenario,
): BudgetPlan {
  if (scenario.kind === "one-time-spend") {
    return {
      ...plan,
      financialEvents: [
        ...plan.financialEvents,
        {
          id: scenario.id,
          createdAt: "simulation",
          updatedAt: "simulation",
          date: scenario.date,
          kind: "spending",
          amount: scenario.amount,
          categoryId: scenario.categoryId,
          note: scenario.note,
        },
      ],
    };
  }

  if (scenario.kind === "available-money-adjustment") {
    return {
      ...plan,
      financialEvents: [
        ...plan.financialEvents,
        {
          id: scenario.id,
          createdAt: "simulation",
          updatedAt: "simulation",
          date: scenario.date,
          kind: scenario.amountDelta >= 0 ? "income-received" : "spending",
          amount: Math.abs(scenario.amountDelta),
          note: scenario.note,
        },
      ],
    };
  }

  if (scenario.kind === "commitment-add") {
    return {
      ...plan,
      plannedRecords: {
        ...plan.plannedRecords,
        commitmentTemplates: [
          ...plan.plannedRecords.commitmentTemplates,
          scenario.commitment,
        ],
      },
    };
  }

  if (scenario.kind === "commitment-remove") {
    return {
      ...plan,
      plannedRecords: {
        ...plan.plannedRecords,
        commitmentTemplates: plan.plannedRecords.commitmentTemplates.filter(
          (commitment) => commitment.id !== scenario.commitmentTemplateId,
        ),
      },
    };
  }

  if (scenario.kind === "commitment-change") {
    return {
      ...plan,
      plannedRecords: {
        ...plan.plannedRecords,
        commitmentTemplates: plan.plannedRecords.commitmentTemplates.map(
          (commitment) =>
            commitment.id === scenario.commitmentTemplateId
              ? { ...commitment, ...scenario.changes }
              : commitment,
        ),
      },
    };
  }

  if (scenario.kind === "buffer-change") {
    return {
      ...plan,
      fixedBuffer: scenario.fixedBuffer,
    };
  }

  if (scenario.kind === "savings-goal-change") {
    return {
      ...plan,
      plannedRecords: {
        ...plan.plannedRecords,
        savingsGoals: plan.plannedRecords.savingsGoals.map((goal) =>
          goal.id === scenario.savingsGoalId
            ? {
                ...goal,
                status: scenario.status ?? goal.status,
                protected: scenario.protected ?? goal.protected,
              }
            : goal,
        ),
      },
    };
  }

  return plan;
}

function calculateSimulationDifference(
  current: SafeToSpendResult,
  simulated: SafeToSpendResult,
): BudgetSimulationDifference {
  return {
    rawSafePool:
      simulated.confirmed.rawSafePool - current.confirmed.rawSafePool,
    safeThisPeriod:
      simulated.confirmed.safeThisPeriod - current.confirmed.safeThisPeriod,
    safeToday: simulated.confirmed.safeToday - current.confirmed.safeToday,
    safeThisWeek:
      simulated.confirmed.safeThisWeek - current.confirmed.safeThisWeek,
    effectiveAvailableMoney:
      simulated.breakdown.effectiveAvailableMoney -
      current.breakdown.effectiveAvailableMoney,
    unpaidCommitments:
      simulated.breakdown.unpaidCommitments -
      current.breakdown.unpaidCommitments,
    protectedSavings:
      simulated.breakdown.protectedSavings -
      current.breakdown.protectedSavings,
    fixedBuffer: simulated.breakdown.fixedBuffer - current.breakdown.fixedBuffer,
    projectedIncome:
      simulated.breakdown.projectedIncome - current.breakdown.projectedIncome,
  };
}

function financialEventLedgerRow(event: FinancialEventRecord): ExportLedgerRow {
  return {
    id: event.id,
    date: event.date,
    rowType: "financial-event",
    label: event.note ?? event.kind,
    amount: financialEventSignedAmount(event),
    categoryId: event.categoryId,
    relatedRecordId:
      event.commitmentTemplateId ?? event.savingsGoalId ?? event.incomeTemplateId,
  };
}

function commitmentOccurrenceLedgerRow(
  occurrence: CommitmentOccurrence,
): ExportLedgerRow {
  return {
    id: occurrence.id,
    date: occurrence.date,
    rowType: "commitment-occurrence",
    label: occurrence.name,
    amount: -occurrence.remainingUnpaidAmount,
    relatedRecordId: occurrence.templateId,
  };
}

function financialEventSignedAmount(event: FinancialEventRecord): Money {
  if (
    event.kind === "spending" ||
    event.kind === "commitment-payment" ||
    event.kind === "savings-contribution"
  ) {
    return -event.amount;
  }

  return event.amount;
}

function calculateSafeToSpendMetrics(
  rawSafePool: Money,
  today: DateOnly,
  activePeriod: ActiveBudgetPeriod,
): SafeToSpendMetrics {
  const safeThisPeriod = Math.max(0, rawSafePool);
  const daysRemaining = inclusiveDaysRemaining(today, activePeriod.endDate);
  const safeToday = Math.floor(safeThisPeriod / daysRemaining);
  const weekDays = Math.min(7, daysRemaining);

  return {
    rawSafePool,
    safeThisPeriod,
    safeToday,
    safeThisWeek: safeToday * weekDays,
  };
}

function budgetHealth(
  rawSafePool: Money,
  effectiveAvailableMoney: Money,
  fixedBuffer: Money,
): BudgetHealthStatus {
  if (rawSafePool < 0) {
    return "overspending";
  }

  if (fixedBuffer > 0 && rawSafePool < fixedBuffer) {
    return "risky";
  }

  const ratio =
    effectiveAvailableMoney <= 0 ? 0 : rawSafePool / effectiveAvailableMoney;

  if (ratio < 0.05) {
    return "risky";
  }

  if (ratio < 0.3) {
    return "tight";
  }

  return "safe";
}

function generateBudgetWarnings(
  plan: BudgetPlan,
  rawSafePool: Money,
  commitmentOccurrences: readonly CommitmentOccurrence[],
  savingsGoalAllocations: readonly SavingsGoalAllocation[],
  categorySummaries: readonly CategorySummary[],
): BudgetWarning[] {
  if (rawSafePool < 0) {
    return [
      {
        id: `critical-shortfall:${plan.id}`,
        severity: "critical",
        code: "critical-shortfall",
        metadata: {
          rawSafePool,
          shortfallAmount: Math.abs(rawSafePool),
        },
      },
    ];
  }

  const commitmentWarnings: BudgetWarning[] = commitmentOccurrences.flatMap((occurrence) => {
    if (occurrence.paid || occurrence.timing === "future") {
      return [];
    }

    const code =
      occurrence.timing === "overdue"
        ? "overdue-commitment"
        : "commitment-due-today";

    return [
      {
        id: `${code}:${occurrence.templateId}:${occurrence.date}`,
        severity: occurrence.timing === "overdue" ? "critical" : "warning",
        code,
        metadata: {
          commitmentTemplateId: occurrence.templateId,
          occurrenceDate: occurrence.date,
          kind: occurrence.kind,
          remainingUnpaidAmount: occurrence.remainingUnpaidAmount,
        },
      },
    ];
  });

  const savingsWarnings: BudgetWarning[] = savingsGoalAllocations
    .filter((allocation) => allocation.overdueIncomplete)
    .map((allocation) => ({
      id: `overdue-savings-goal:${allocation.goalId}`,
      severity: "warning" as const,
      code: "overdue-savings-goal" as const,
      metadata: {
        savingsGoalId: allocation.goalId,
        remainingAmount: allocation.remainingAmount,
        targetDate: plan.plannedRecords.savingsGoals.find(
          (goal) => goal.id === allocation.goalId,
        )?.targetDate,
      },
    }));

  const categoryWarnings: BudgetWarning[] = categorySummaries
    .filter((summary) => summary.overageAmount > 0)
    .map((summary) => ({
      id: `category-overage:${summary.categoryId}`,
      severity: "guidance" as const,
      code: "category-overage" as const,
      metadata: {
        categoryId: summary.categoryId,
        spentAmount: summary.spentAmount,
        periodLimit: summary.periodLimit,
        overageAmount: summary.overageAmount,
      },
    }));

  return [...commitmentWarnings, ...savingsWarnings, ...categoryWarnings];
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

function latestBalanceSnapshot(
  snapshots: readonly BalanceSnapshot[],
): BalanceSnapshot | undefined {
  return [...snapshots].sort(compareBalanceSnapshots).at(-1);
}

function eventHappenedAfterSnapshot(
  event: FinancialEventRecord,
  snapshot: BalanceSnapshot,
): boolean {
  const dateComparison = compareDateOnly(event.date, snapshot.date);

  if (dateComparison !== 0) {
    return dateComparison > 0;
  }

  return compareTimestamp(event.createdAt, snapshot.createdAt) > 0;
}

function dateOnlyIsInsidePeriod(
  date: DateOnly,
  period: ActiveBudgetPeriod,
): boolean {
  return (
    compareDateOnly(date, period.startDate) >= 0 &&
    compareDateOnly(date, period.endDate) <= 0
  );
}

function savingsContributionsForGoal(
  goalId: EntityId,
  plan: BudgetPlan,
): Money {
  return plan.financialEvents
    .filter(
      (event) =>
        event.kind === "savings-contribution" &&
        event.savingsGoalId === goalId &&
        dateOnlyIsInsidePeriod(event.date, plan.activePeriod),
    )
    .reduce((total, event) => total + event.amount, 0);
}

function spendingForCategory(categoryId: EntityId, plan: BudgetPlan): Money {
  return plan.financialEvents
    .filter(
      (event) =>
        event.kind === "spending" &&
        event.categoryId === categoryId &&
        dateOnlyIsInsidePeriod(event.date, plan.activePeriod),
    )
    .reduce((total, event) => total + event.amount, 0);
}

function projectedIncomeThroughPeriodEnd(
  plan: BudgetPlan,
  today: DateOnly,
): Money {
  const projectionPeriod = {
    startDate: laterDateOnly(today, plan.activePeriod.startDate),
    endDate: plan.activePeriod.endDate,
  };

  return plan.plannedRecords.incomeTemplates
    .filter((template) => template.active && template.includeInProjection)
    .flatMap((template) =>
      generateRecurrenceOccurrences({
        templateId: template.id,
        startsOn: template.startsOn,
        endsOn: template.endsOn,
        recurrence: template.recurrence,
        period: projectionPeriod,
      }).map(() => template.amount),
    )
    .reduce((total, amount) => total + amount, 0);
}

function suggestedSavingsContribution(
  goal: SavingsGoal,
  period: ActiveBudgetPeriod,
): Money {
  if (goal.targetDate === undefined) {
    return 0;
  }

  const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
  const periodLength = inclusiveDaysRemaining(period.startDate, period.endDate);
  const remainingPeriodLength = inclusiveDaysRemaining(
    period.endDate,
    goal.targetDate,
  );
  const remainingPeriods = Math.max(
    1,
    Math.ceil(remainingPeriodLength / periodLength),
  );

  return Math.ceil(remainingAmount / remainingPeriods);
}

function savingsGoalIsOverdueIncomplete(
  goal: SavingsGoal,
  remainingAmount: Money,
  period: ActiveBudgetPeriod,
): boolean {
  return (
    goal.status === "active" &&
    goal.targetDate !== undefined &&
    remainingAmount > 0 &&
    compareDateOnly(goal.targetDate, period.startDate) < 0
  );
}

function effectiveAvailableMoneyEventImpact(
  event: FinancialEventRecord,
): Money {
  if (
    event.kind === "spending" ||
    event.kind === "commitment-payment" ||
    event.kind === "savings-contribution"
  ) {
    return -event.amount;
  }

  if (event.kind === "income-received") {
    return event.amount;
  }

  return 0;
}

function compareBalanceSnapshots(
  left: BalanceSnapshot,
  right: BalanceSnapshot,
): number {
  const dateComparison = compareDateOnly(left.date, right.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return compareTimestamp(left.createdAt, right.createdAt);
}

function compareTimestamp(left: Timestamp, right: Timestamp): number {
  return Date.parse(left) - Date.parse(right);
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
