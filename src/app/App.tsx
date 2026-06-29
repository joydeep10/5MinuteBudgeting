import { useState } from "react";

import {
  addCommitmentTemplate,
  addCustomCategory,
  addSavingsGoal,
  markCommitmentPaid,
  recordSavingsContribution,
  setReminderPreferences,
  setFlexibleCategoryGuidance,
  suggestNextActivePeriod,
  updateCommitmentTemplate,
  updateSavingsGoal,
} from "../application";
import type { ApplicationServices, CommitmentTemplateDraft } from "../application";
import {
  correctDailyActivity,
  deleteDailyActivity,
  performDailyAction,
  undoLastDailyActivity,
} from "../features/dailyActions";
import {
  applyConfirmedSimulatorScenario,
  previewSimulatorScenario,
} from "../features/simulator";
import {
  calculateCategorySummaries,
  calculateSafeToSpend,
  calculateSavingsGoalAllocations,
  calculateSpendingLoggedThisPeriod,
  generateCommitmentOccurrences,
} from "../domain";
import type {
  BalanceSnapshot,
  BudgetMode,
  BudgetPlan,
  BudgetSimulationScenario,
  BudgetWarning,
  CategorySummary,
  CommitmentOccurrence,
  CommitmentTemplate,
  CurrencyMetadata,
  DateOnly,
  FinancialEventRecord,
  Money,
  PeriodSnapshot,
  ReminderPreferences,
  RecurrenceFrequency,
  RecurrenceRule,
  SavingsGoalStatus,
} from "../domain";
import {
  completeSetupWizard,
  estimateSetupWizardResult,
  formatMoney,
  parseMoneyInput,
} from "../features/setupWizard";
import { completePeriodRollover } from "../features/periodRollover";
import type {
  CommitmentShortcut,
  SetupWizardSubmission,
} from "../features/setupWizard";
import { createBrowserNotificationAdapter } from "../infrastructure";
import type {
  BrowserNotificationAdapter,
  BudgetPlanRepository,
  NotificationPermissionStatus,
} from "../infrastructure";

export type AppView = "landing" | "setup" | "dashboard" | "simulator";

export interface AppProps {
  hasSavedBudget?: boolean;
  initialView?: AppView;
  initialPlan?: BudgetPlan;
  initialSetupSubmission?: Partial<SetupWizardSubmission>;
  repository?: BudgetPlanRepository;
  notificationAdapter?: BrowserNotificationAdapter;
  services?: ApplicationServices;
  today?: DateOnly;
}

export interface LandingResumeSource {
  loadActivePlan: () => Promise<BudgetPlan | undefined>;
}

export async function loadLandingResumeState(
  source: LandingResumeSource,
): Promise<AppProps> {
  const savedBudget = await source.loadActivePlan();

  return {
    hasSavedBudget: savedBudget !== undefined,
    initialPlan: savedBudget,
  };
}

export function App({
  hasSavedBudget = false,
  initialView = "landing",
  initialPlan,
  initialSetupSubmission,
  notificationAdapter = createBrowserNotificationAdapter(),
  repository,
  services = createBrowserApplicationServices(),
  today = currentDateOnly(),
}: AppProps) {
  const [view, setView] = useState<AppView>(initialView);
  const [plan, setPlan] = useState<BudgetPlan | undefined>(initialPlan);

  if (view === "setup") {
    return (
      <SetupWizard
        initialSubmission={initialSetupSubmission}
        repository={repository}
        services={services}
        today={today}
        onComplete={(createdPlan) => {
          setPlan(createdPlan);
          setView("dashboard");
        }}
        onBack={() => setView("landing")}
      />
    );
  }

  if (view === "dashboard") {
    return plan === undefined ? (
      <EmptyDashboard onStartBudgeting={() => setView("setup")} />
    ) : (
      <Dashboard
        plan={plan}
        notificationAdapter={notificationAdapter}
        repository={repository}
        services={services}
        today={today}
        onPlanChange={setPlan}
        onOpenSimulator={() => setView("simulator")}
      />
    );
  }

  if (view === "simulator") {
    return plan === undefined ? (
      <EmptyDashboard onStartBudgeting={() => setView("setup")} />
    ) : (
      <Simulator
        plan={plan}
        repository={repository}
        services={services}
        today={today}
        onBack={() => setView("dashboard")}
        onPlanChange={setPlan}
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-section" aria-labelledby="app-title">
        <div className="hero-copy">
          <p className="eyebrow">5-Minute Budgeting</p>
          <h1 id="app-title">Know what is safe to spend today</h1>
          <p className="hero-lede">
            A calm, browser-local budget that protects bills, savings, and your
            buffer before showing what you can actually use.
          </p>
          <LandingActions
            hasSavedBudget={hasSavedBudget}
            onOpenBudget={() => setView("dashboard")}
            onStartBudgeting={() => setView("setup")}
          />
          {hasSavedBudget ? (
            <p className="restart-note" id="restart-protection">
              You will confirm before replacing this browser budget.
            </p>
          ) : null}
        </div>

        <div className="trust-signals" aria-label="Privacy-first trust signals">
          <p>No signup</p>
          <p>No bank connection</p>
          <p>Saved in this browser</p>
        </div>
      </section>

      <section className="content-section" aria-labelledby="what-it-does">
        <p className="section-kicker">What it does</p>
        <h2 id="what-it-does">Turns your balance into an honest spending number.</h2>
        <p>
          5-Minute Budgeting starts with money you can actually use, then sets
          aside upcoming commitments, protected savings, and a safety buffer
          before showing what is safe for today.
        </p>
      </section>

      <section className="content-section section-grid" aria-labelledby="how-it-works">
        <div>
          <p className="section-kicker">How it works</p>
          <h2 id="how-it-works">Setup stays small, then accuracy improves over time.</h2>
        </div>
        <div className="step-list">
          <article className="step-card">
            <span>1</span>
            <h3>Add your usable balance</h3>
            <p>Start from the cash you are willing to budget from today.</p>
          </article>
          <article className="step-card">
            <span>2</span>
            <h3>Protect what is already spoken for</h3>
            <p>Include bills, savings goals, and the buffer you do not want to cross.</p>
          </article>
          <article className="step-card">
            <span>3</span>
            <h3>Check the safe-to-spend answer</h3>
            <p>Use the result for today, then refine categories and reminders later.</p>
          </article>
        </div>
      </section>

      <section className="content-section privacy-section" aria-labelledby="privacy">
        <p className="section-kicker">Private by design</p>
        <h2 id="privacy">No account, no bank link, no remote sync in V1.</h2>
        <p>
          Your budget is saved locally in this browser so you can return without
          creating an account. Backup and import are separate choices when you
          want a copy.
        </p>
      </section>

      <section className="final-cta" aria-labelledby="final-cta-title">
        <div>
          <p className="section-kicker">Start your 5-minute budget</p>
          <h2 id="final-cta-title">Find the number you can act on today.</h2>
        </div>
        <LandingActions
          hasSavedBudget={hasSavedBudget}
          onOpenBudget={() => setView("dashboard")}
          onStartBudgeting={() => setView("setup")}
          compact
        />
      </section>
    </main>
  );
}

interface LandingActionsProps {
  hasSavedBudget: boolean;
  onOpenBudget: () => void;
  onStartBudgeting: () => void;
  compact?: boolean;
}

function LandingActions({
  hasSavedBudget,
  onOpenBudget,
  onStartBudgeting,
  compact = false,
}: LandingActionsProps) {
  return (
    <div className={compact ? "hero-actions compact-actions" : "hero-actions"}>
      {hasSavedBudget ? (
        <>
          <button
            className="button button-primary"
            type="button"
            onClick={onOpenBudget}
          >
            Open my budget
          </button>
          <button
            className="button button-secondary"
            type="button"
            aria-describedby="restart-protection"
            onClick={() => confirmStartNewBudget(onStartBudgeting)}
          >
            Start a new budget
          </button>
        </>
      ) : (
        <button
          className="button button-primary"
          type="button"
          onClick={onStartBudgeting}
        >
          Start budgeting
        </button>
      )}
    </div>
  );
}

interface SetupWizardProps {
  initialSubmission?: Partial<SetupWizardSubmission>;
  repository?: BudgetPlanRepository;
  services: ApplicationServices;
  today: DateOnly;
  onComplete: (plan: BudgetPlan) => void;
  onBack: () => void;
}

function SetupWizard({
  initialSubmission = {},
  repository,
  services,
  today,
  onComplete,
  onBack,
}: SetupWizardProps) {
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [draft, setDraft] =
    useState<Partial<SetupWizardSubmission>>(initialSubmission);
  const estimate = estimateSetupWizardResult({
    submission: draft,
    today,
  });

  function updateDraft(event: React.FormEvent<HTMLFormElement>) {
    setDraft(setupDraftFromForm(new FormData(event.currentTarget)));
  }

  async function submitSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (repository === undefined) {
      setErrorMessage("Budget storage is not ready. Try again in a moment.");
      return;
    }

    try {
      const completion = await completeSetupWizard(
        setupSubmissionFromForm(new FormData(event.currentTarget)),
        {
          repository,
          services,
          today,
        },
      );

      setErrorMessage(undefined);
      onComplete(completion.plan);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Check your setup answers.",
      );
    }
  }

  return (
    <main className="app-shell setup-shell">
      <section className="setup-header" aria-labelledby="setup-title">
        <button className="text-button" type="button" onClick={onBack}>
          Back
        </button>
        <p className="eyebrow">First budget setup</p>
        <h1 id="setup-title">Set up your first budget</h1>
        <p className="hero-lede">
          Answer only what is needed to calculate a trustworthy starting number.
        </p>
      </section>

      <form
        className="setup-grid"
        aria-label="Setup wizard"
        onChange={updateDraft}
        onSubmit={submitSetup}
      >
        <section className="setup-card" aria-labelledby="setup-money">
          <p className="step-label">1. Money you can use</p>
          <h2 id="setup-money">Start with the balance you can budget from.</h2>
          <label>
            Currency
            <select name="currency" defaultValue={initialSubmission.currencyCode ?? "USD"}>
              <option value="USD">USD - $</option>
              <option value="INR">INR - Rs</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>
            Current usable balance
            <input
              defaultValue={initialSubmission.currentUsableBalance}
              inputMode="decimal"
              name="current-usable-balance"
              placeholder="$1,250.00"
              required
            />
          </label>
        </section>

        <section className="setup-card" aria-labelledby="setup-mode">
          <p className="step-label">2. Your budget rhythm</p>
          <h2 id="setup-mode">Choose the option that sounds most like you.</h2>
          <div className="choice-grid">
            <label>
              <input
                defaultChecked={initialSubmission.mode === "fixed-income"}
                name="mode"
                type="radio"
                value="fixed-income"
                required
              />
              Regular paycheck
            </label>
            <label>
              <input
                defaultChecked={initialSubmission.mode === "irregular-income"}
                name="mode"
                type="radio"
                value="irregular-income"
              />
              Irregular income
            </label>
            <label>
              <input
                defaultChecked={initialSubmission.mode === "general"}
                name="mode"
                type="radio"
                value="general"
              />
              General budget
            </label>
          </div>
          <label>
            Period starts
            <input
              defaultValue={initialSubmission.periodStartDate}
              name="period-start"
              type="date"
              required
            />
          </label>
          <label>
            Next payday
            <input
              defaultValue={initialSubmission.nextPayday}
              name="next-payday"
              type="date"
            />
          </label>
          <label>
            Period ends
            <input
              defaultValue={initialSubmission.periodEndDate}
              name="period-end"
              type="date"
            />
          </label>
        </section>

        <section className="setup-card" aria-labelledby="setup-commitments">
          <p className="step-label">3. Money already spoken for</p>
          <h2 id="setup-commitments">Add upcoming commitments.</h2>
          <div className="chip-row" aria-label="Commitment shortcuts">
            <button type="button">Rent</button>
            <button type="button">EMI</button>
            <button type="button">Utilities</button>
            <button type="button">Subscriptions</button>
            <button type="button">Custom</button>
          </div>
          <label className="inline-choice">
            <input name="no-commitments" type="checkbox" />
            I have none
          </label>
          <div className="commitment-fields">
            <label>
              Commitment shortcut
              <select name="commitment-shortcut" defaultValue="Rent">
                <option value="Rent">Rent</option>
                <option value="EMI">EMI</option>
                <option value="Utilities">Utilities</option>
                <option value="Subscriptions">Subscriptions</option>
                <option value="Custom">Custom</option>
              </select>
            </label>
            <label>
              Amount
              <input inputMode="decimal" name="commitment-amount" />
            </label>
            <label>
              Due date
              <input name="commitment-due-date" type="date" />
            </label>
            <label>
              Custom name
              <input name="commitment-name" />
            </label>
          </div>
        </section>

        <section className="setup-card" aria-labelledby="setup-buffer">
          <p className="step-label">4. Cushion</p>
          <h2 id="setup-buffer">Pick a safety buffer.</h2>
          <div className="chip-row" aria-label="Suggested buffer choices">
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, safetyBuffer: "$50.00" }))}
            >
              $50
            </button>
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, safetyBuffer: "$100.00" }))}
            >
              $100
            </button>
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, safetyBuffer: "$250.00" }))}
            >
              $250
            </button>
            <button type="button">Custom buffer</button>
          </div>
          <label>
            Safety buffer
            <input
              inputMode="decimal"
              name="safety-buffer"
              placeholder="$100.00"
              required
              value={draft.safetyBuffer ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  safetyBuffer: event.target.value,
                }))
              }
            />
          </label>
        </section>

        <section className="setup-card review-card" aria-labelledby="setup-review">
          <p className="step-label">5. Review</p>
          <h2 id="setup-review">Calculate your first result.</h2>
          {errorMessage === undefined ? null : (
            <p className="validation-message" role="alert">
              {errorMessage}
            </p>
          )}
          <button className="button button-primary" type="submit">
            Show my safe-to-spend number
          </button>
        </section>
      </form>

      {estimate === undefined ? null : (
        <aside className="estimate-panel" aria-label="Provisional estimate">
          <p className="section-kicker">This is an estimate</p>
          <h2>Estimated safe to spend today</h2>
          <p className="money-preview">
            {formatMoney(
              estimate.result.confirmed.safeToday,
              estimate.plan.currency,
            )}
          </p>
        </aside>
      )}
    </main>
  );
}

function setupDraftFromForm(formData: FormData): Partial<SetupWizardSubmission> {
  const draft: Partial<SetupWizardSubmission> = {};
  const currencyCode = stringField(formData, "currency");
  const currentUsableBalance = stringField(formData, "current-usable-balance");
  const periodStartDate = stringField(formData, "period-start");
  const periodEndDate = optionalStringField(formData, "period-end");
  const nextPayday = optionalStringField(formData, "next-payday");
  const safetyBuffer = stringField(formData, "safety-buffer");
  const mode = optionalBudgetModeField(formData, "mode");
  const noCommitments = formData.get("no-commitments") === "on";
  const commitmentAmount = stringField(formData, "commitment-amount");
  const commitmentDueDate = stringField(formData, "commitment-due-date");

  if (currencyCode !== "") {
    draft.currencyCode = currencyCode;
  }

  if (currentUsableBalance !== "") {
    draft.currentUsableBalance = currentUsableBalance;
  }

  if (mode !== undefined) {
    draft.mode = mode;
  }

  if (periodStartDate !== "") {
    draft.periodStartDate = periodStartDate;
  }

  draft.periodEndDate = periodEndDate;
  draft.nextPayday = nextPayday;

  if (noCommitments) {
    draft.commitments = [];
  } else if (commitmentAmount !== "" || commitmentDueDate !== "") {
    draft.commitments = [
      {
        shortcut: commitmentShortcutField(formData, "commitment-shortcut"),
        amount: commitmentAmount,
        dueDate: commitmentDueDate,
        name: optionalStringField(formData, "commitment-name"),
      },
    ];
  }

  if (safetyBuffer !== "") {
    draft.safetyBuffer = safetyBuffer;
  }

  return draft;
}

function setupSubmissionFromForm(formData: FormData): SetupWizardSubmission {
  const noCommitments = formData.get("no-commitments") === "on";
  const commitmentAmount = stringField(formData, "commitment-amount");
  const commitmentDueDate = stringField(formData, "commitment-due-date");
  const shortcut = commitmentShortcutField(formData, "commitment-shortcut");

  return {
    currencyCode: stringField(formData, "currency"),
    currentUsableBalance: stringField(formData, "current-usable-balance"),
    mode: budgetModeField(formData, "mode"),
    periodStartDate: stringField(formData, "period-start"),
    periodEndDate: optionalStringField(formData, "period-end"),
    nextPayday: optionalStringField(formData, "next-payday"),
    commitments:
      noCommitments || commitmentAmount === "" || commitmentDueDate === ""
        ? []
        : [
            {
              shortcut,
              amount: commitmentAmount,
              dueDate: commitmentDueDate,
              name: optionalStringField(formData, "commitment-name"),
            },
          ],
    safetyBuffer: stringField(formData, "safety-buffer"),
  };
}

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalStringField(formData: FormData, name: string): string | undefined {
  const value = stringField(formData, name).trim();
  return value === "" ? undefined : value;
}

function budgetModeField(formData: FormData, name: string): BudgetMode {
  const value = optionalBudgetModeField(formData, name);

  if (value !== undefined) {
    return value;
  }

  throw new RangeError("Choose how you want to budget.");
}

function optionalBudgetModeField(
  formData: FormData,
  name: string,
): BudgetMode | undefined {
  const value = stringField(formData, name);

  if (
    value === "fixed-income" ||
    value === "irregular-income" ||
    value === "general"
  ) {
    return value;
  }

  return undefined;
}

function commitmentShortcutField(
  formData: FormData,
  name: string,
): CommitmentShortcut {
  const value = stringField(formData, name);

  if (
    value === "Rent" ||
    value === "EMI" ||
    value === "Utilities" ||
    value === "Subscriptions" ||
    value === "Custom"
  ) {
    return value;
  }

  return "Custom";
}

function confirmStartNewBudget(onStartBudgeting: () => void): void {
  if (window.confirm("Start a new budget and replace this browser budget?")) {
    onStartBudgeting();
  }
}

interface DashboardProps {
  plan: BudgetPlan;
  notificationAdapter: BrowserNotificationAdapter;
  repository?: BudgetPlanRepository;
  services: ApplicationServices;
  today: DateOnly;
  onPlanChange: (plan: BudgetPlan) => void;
  onOpenSimulator: () => void;
}

function Dashboard({
  plan,
  notificationAdapter,
  repository,
  services,
  today,
  onPlanChange,
  onOpenSimulator,
}: DashboardProps) {
  const [workflowMessage, setWorkflowMessage] = useState<string | undefined>();
  const result = calculateSafeToSpend({ plan, today });
  const money = (amount: Money) => formatMoney(amount, plan.currency);
  const spendingLoggedThisPeriod = calculateSpendingLoggedThisPeriod(plan);
  const commitments = generateCommitmentOccurrences({
    commitments: plan.plannedRecords.commitmentTemplates,
    period: plan.activePeriod,
    today,
    financialEvents: plan.financialEvents,
    amountOverrides: [],
  });
  const savingsGoalAllocations = calculateSavingsGoalAllocations(plan);
  const categorySummaries = calculateCategorySummaries(plan);
  const shouldInviteRefinement = budgetCouldUseRefinement(plan);
  const warnings = rankedBudgetWarnings(result.warnings);
  const topWarning = warnings[0];
  const remainingWarnings = warnings.slice(1);

  async function savePlan(nextPlan: BudgetPlan, message: string) {
    onPlanChange(nextPlan);
    setWorkflowMessage(message);
    await repository?.saveActivePlan(nextPlan);
  }

  function changePlan(nextPlan: BudgetPlan) {
    void savePlan(nextPlan, "Budget workflow updated.");
  }

  async function submitCommitmentPayment(
    occurrence: CommitmentOccurrence,
    amount?: Money,
  ) {
    try {
      const nextPlan = markCommitmentPaid(
        plan,
        {
          date: today,
          commitmentTemplateId: occurrence.templateId,
          occurrenceDate: occurrence.date,
          amount,
        },
        services,
      );

      await savePlan(nextPlan, "Commitment payment recorded.");
    } catch (error) {
      setWorkflowMessage(
        error instanceof Error
          ? error.message
          : "Payment could not be recorded.",
      );
    }
  }

  async function submitPartialPayment(
    occurrence: CommitmentOccurrence,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    await submitCommitmentPayment(
      occurrence,
      parseMoneyForCurrency(
        stringField(formData, "partial-payment"),
        plan.currency,
        "Partial payment",
      ),
    );
  }

  async function submitCommitment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget);
      const selectedCommitmentId = optionalStringField(formData, "commitment-id");
      const draft = commitmentDraftFromForm(formData, plan.currency);
      const nextPlan =
        selectedCommitmentId === undefined
          ? addCommitmentTemplate(plan, draft, services)
          : updateCommitmentTemplate(
              plan,
              selectedCommitmentId,
              draft,
              services,
            );

      await savePlan(
        nextPlan,
        selectedCommitmentId === undefined
          ? "Commitment added."
          : "Commitment updated.",
      );
    } catch (error) {
      setWorkflowMessage(
        error instanceof Error
          ? error.message
          : "Commitment could not be saved.",
      );
    }
  }

  return (
    <main className="app-shell dashboard-shell">
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <p className="eyebrow">Your first result</p>
        <h1 id="dashboard-title">Safe to spend today</h1>
        <p className="money-hero">{money(result.confirmed.safeToday)}</p>
        <div className="hero-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onOpenSimulator}
          >
            Simulator
          </button>
        </div>
        <div className="result-grid" aria-label="Budget runway">
          <article>
            <p>Safe this week</p>
            <strong>{money(result.confirmed.safeThisWeek)}</strong>
          </article>
          <article>
            <p>Safe this period</p>
            <strong>{money(result.confirmed.safeThisPeriod)}</strong>
          </article>
        </div>
        {topWarning === undefined ? null : (
          <BudgetWarningCard
            currency={plan.currency}
            prominent
            warning={topWarning}
          />
        )}
      </section>

      <section className="dashboard-breakdown" aria-labelledby="breakdown-title">
        <p className="section-kicker">Why this is the number</p>
        <h2 id="breakdown-title">Your starting breakdown</h2>
        <dl>
          <div>
            <dt>Available money</dt>
            <dd>{money(result.breakdown.effectiveAvailableMoney)}</dd>
          </div>
          <div>
            <dt>Upcoming commitments</dt>
            <dd>{money(result.breakdown.unpaidCommitments)}</dd>
          </div>
          <div>
            <dt>Protected savings</dt>
            <dd>{money(result.breakdown.protectedSavings)}</dd>
          </div>
          <div>
            <dt>Safety buffer</dt>
            <dd>{money(result.breakdown.fixedBuffer)}</dd>
          </div>
          <div>
            <dt>Spending logged this period</dt>
            <dd>{money(spendingLoggedThisPeriod)}</dd>
          </div>
        </dl>
        <p className="breakdown-note">
          Spending and payments are already reflected in available money.
        </p>
      </section>

      <DailyActionPanel
        onPlanChange={onPlanChange}
        plan={plan}
        repository={repository}
        services={services}
        today={today}
      />

      <ReminderPanel
        commitments={commitments}
        notificationAdapter={notificationAdapter}
        onPreferencesChange={(preferences) =>
          void savePlan(
            setReminderPreferences(plan, preferences, services),
            "Reminder settings saved.",
          )
        }
        preferences={plan.reminderPreferences}
      />

      <section className="commitments-panel" aria-labelledby="commitments-title">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Bills and debts</p>
            <h2 id="commitments-title">Commitments</h2>
          </div>
          <p>{money(result.breakdown.unpaidCommitments)} still unpaid</p>
        </div>

        {workflowMessage === undefined ? null : (
          <p className="validation-message" role="status">
            {workflowMessage}
          </p>
        )}

        {commitments.length === 0 ? (
          <p className="empty-note">
            Add rent, EMI, utilities, subscriptions, or a custom commitment when money is already spoken for.
          </p>
        ) : (
          <div className="commitment-list">
            {commitments.map((commitment) => (
              <CommitmentCard
                commitment={commitment}
                currency={plan.currency}
                key={commitment.id}
                paymentHistory={paymentHistoryForCommitment(
                  plan.financialEvents,
                  commitment,
                )}
                template={plan.plannedRecords.commitmentTemplates.find(
                  (template) => template.id === commitment.templateId,
                )}
                onFullPayment={() => submitCommitmentPayment(commitment)}
                onPartialPayment={(event) =>
                  submitPartialPayment(commitment, event)
                }
              />
            ))}
          </div>
        )}

        <form
          className="commitment-editor"
          aria-label="Add or edit commitment"
          onSubmit={submitCommitment}
        >
          <h3>Add or edit commitment</h3>
          <div className="commitment-fields">
            <label>
              Existing commitment
              <select name="commitment-id" defaultValue="">
                <option value="">Add a new commitment</option>
                {plan.plannedRecords.commitmentTemplates.map((commitment) => (
                  <option key={commitment.id} value={commitment.id}>
                    Edit {commitment.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Commitment type
              <select name="commitment-type" defaultValue="Rent">
                <option value="Rent">Rent</option>
                <option value="EMI">EMI</option>
                <option value="Utilities">Utilities</option>
                <option value="Subscriptions">Subscriptions</option>
                <option value="Custom">Custom</option>
              </select>
            </label>
            <label>
              Custom label
              <input name="commitment-name" placeholder="School fees" />
            </label>
            <label>
              Amount
              <input inputMode="decimal" name="commitment-amount" required />
            </label>
            <label>
              Due date
              <input name="commitment-due-date" required type="date" />
            </label>
            <label>
              Recurrence
              <select name="commitment-recurrence" defaultValue="monthly">
                <option value="one-time">One-time</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
          </div>
          <button className="button button-primary" type="submit">
            Save commitment
          </button>
        </form>
      </section>

      {shouldInviteRefinement ? (
        <section className="refinement-panel" aria-labelledby="refinement-title">
          <p className="section-kicker">Refine this budget</p>
          <h2 id="refinement-title">Ready when you are</h2>
          <p>
            Your budget is ready to use. Add commitments, protected savings, or a buffer when you want a sharper number.
          </p>
        </section>
      ) : null}

      <SavingsGoalsPanel
        allocations={savingsGoalAllocations}
        currency={plan.currency}
        plan={plan}
        services={services}
        today={today}
        onPlanChange={changePlan}
      />

      <CategoryGuidancePanel
        categorySummaries={categorySummaries}
        currency={plan.currency}
        plan={plan}
        services={services}
        onPlanChange={changePlan}
      />

      {today >= plan.activePeriod.endDate ? (
        <PeriodRolloverPanel
          openingBalance={result.breakdown.effectiveAvailableMoney}
          onPlanChange={onPlanChange}
          plan={plan}
          repository={repository}
          services={services}
          today={today}
        />
      ) : null}

      <PeriodHistoryPanel currency={plan.currency} snapshots={plan.periodSnapshots} />

      {remainingWarnings.length === 0 ? null : (
        <section className="warning-panel" aria-labelledby="warning-panel-title">
          <p className="section-kicker">Keep an eye on</p>
          <h2 id="warning-panel-title">More budget warnings</h2>
          <div className="warning-list">
            {remainingWarnings.map((warning) => (
              <BudgetWarningCard
                currency={plan.currency}
                key={warning.id}
                warning={warning}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

interface SimulatorProps {
  plan: BudgetPlan;
  repository?: BudgetPlanRepository;
  services: ApplicationServices;
  today: DateOnly;
  onBack: () => void;
  onPlanChange: (plan: BudgetPlan) => void;
}

function Simulator({
  plan,
  repository,
  services,
  today,
  onBack,
  onPlanChange,
}: SimulatorProps) {
  const money = (amount: Money) => formatMoney(amount, plan.currency);
  const [scenarioKind, setScenarioKind] =
    useState<SimulatorScenarioKind>("spend-extra");
  const [message, setMessage] = useState<string | undefined>();
  const scenario = defaultSimulatorScenario(plan, today, scenarioKind);
  const simulation = previewSimulatorScenario({
    plan,
    today,
    scenario,
  });
  const warningChange =
    simulation.simulated.warnings.length - simulation.current.warnings.length;

  async function applyScenario() {
    if (repository === undefined) {
      setMessage("Budget storage is not ready. Try again in a moment.");
      return;
    }

    const confirmed = window.confirm(
      "Apply this simulator scenario to your real budget?",
    );

    if (!confirmed) {
      setMessage("Scenario cancelled. Your budget was not changed.");
      return;
    }

    try {
      const completion = await applyConfirmedSimulatorScenario(
        {
          plan,
          today,
          scenario,
          confirmed,
        },
        {
          repository,
          services,
        },
      );

      onPlanChange(completion.plan);
      setMessage("Scenario applied to your budget.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Scenario could not be applied.",
      );
    }
  }

  return (
    <main className="app-shell dashboard-shell">
      <section className="dashboard-hero" aria-labelledby="simulator-title">
        <button className="text-button" type="button" onClick={onBack}>
          Back to dashboard
        </button>
        <p className="eyebrow">Safe exploration</p>
        <h1 id="simulator-title">What-if simulator</h1>
        <p className="hero-lede">
          Try a decision and compare the result. No budget data changes until you apply.
        </p>
      </section>

      <section className="workflow-panel" aria-labelledby="simulator-options-title">
        <div className="workflow-heading">
          <p className="section-kicker">Scenario cards</p>
          <h2 id="simulator-options-title">Choose a guided what-if</h2>
        </div>
        <div className="scenario-grid">
          <button
            className={scenarioCardClass(scenarioKind === "spend-extra")}
            type="button"
            onClick={() => setScenarioKind("spend-extra")}
          >
            <span>Spend extra</span>
            <strong>What if I spend $25 today?</strong>
          </button>
          <button
            className={scenarioCardClass(scenarioKind === "change-bill")}
            type="button"
            onClick={() => setScenarioKind("change-bill")}
          >
            <span>Change a bill</span>
            <strong>What if a bill is $25 higher?</strong>
          </button>
          <button
            className={scenarioCardClass(scenarioKind === "change-buffer")}
            type="button"
            onClick={() => setScenarioKind("change-buffer")}
          >
            <span>Change buffer</span>
            <strong>What if I raise my buffer by $25?</strong>
          </button>
          <button
            className={scenarioCardClass(scenarioKind === "adjust-savings")}
            type="button"
            onClick={() => setScenarioKind("adjust-savings")}
          >
            <span>Adjust a savings goal</span>
            <strong>What if this goal is paused for now?</strong>
          </button>
        </div>
      </section>

      <section className="dashboard-breakdown" aria-labelledby="simulator-impact-title">
        <p className="section-kicker">Before and after</p>
        <h2 id="simulator-impact-title">Safe-to-spend impact</h2>
        <div className="result-grid simulator-impact-grid">
          <article>
            <p>Before</p>
            <strong>{money(simulation.current.confirmed.safeToday)}</strong>
          </article>
          <article>
            <p>After</p>
            <strong>{money(simulation.simulated.confirmed.safeToday)}</strong>
          </article>
          <article>
            <p>Safe this period</p>
            <strong>{money(simulation.current.confirmed.safeThisPeriod)}</strong>
          </article>
          <article>
            <p>After safe this period</p>
            <strong>{money(simulation.simulated.confirmed.safeThisPeriod)}</strong>
          </article>
        </div>
        <p className="breakdown-note">
          This preview uses the same simulator and safe-to-spend calculator as your real budget.
        </p>
        <p className="breakdown-note">
          Warning change: {warningChange >= 0 ? "+" : ""}
          {warningChange}
        </p>
        <div className="warning-list" aria-label="Simulator warning comparison">
          <article className="warning-card">
            <h3>Current warnings</h3>
            <p>{simulatorWarningSummary(simulation.current.warnings, plan.currency)}</p>
          </article>
          <article className="warning-card">
            <h3>Simulated warnings</h3>
            <p>{simulatorWarningSummary(simulation.simulated.warnings, plan.currency)}</p>
          </article>
        </div>
      </section>

      <section className="workflow-panel" aria-labelledby="simulator-apply-title">
        <div className="workflow-heading">
          <p className="section-kicker">Apply safely</p>
          <h2 id="simulator-apply-title">Confirm before changing your budget</h2>
          <p>
            Applying writes this scenario into the real BudgetPlan. Cancel and return leaves the saved budget unchanged.
          </p>
        </div>
        {message === undefined ? null : (
          <p className="validation-message" role="status">
            {message}
          </p>
        )}
        <div className="action-row">
          <button
            className="button button-primary"
            type="button"
            onClick={() => void applyScenario()}
          >
            Apply scenario
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={onBack}
          >
            Cancel and return
          </button>
        </div>
      </section>
    </main>
  );
}

type SimulatorScenarioKind =
  | "spend-extra"
  | "change-bill"
  | "change-buffer"
  | "adjust-savings";

function defaultSimulatorScenario(
  plan: BudgetPlan,
  today: DateOnly,
  scenarioKind: SimulatorScenarioKind,
): BudgetSimulationScenario {
  if (scenarioKind === "change-bill") {
    const commitment = plan.plannedRecords.commitmentTemplates[0];

    if (commitment !== undefined) {
      return {
        kind: "commitment-change",
        commitmentTemplateId: commitment.id,
        changes: {
          amount: commitment.amount + 2_500,
        },
      };
    }

    return {
      kind: "commitment-add",
      commitment: {
        id: "scenario_bill",
        createdAt: "simulation",
        updatedAt: "simulation",
        name: "Possible bill",
        kind: "bill",
        amount: 2_500,
        active: true,
        startsOn: today,
        recurrence: {
          frequency: "one-time",
          interval: 1,
          anchorDate: today,
        },
      },
    };
  }

  if (scenarioKind === "change-buffer") {
    return {
      kind: "buffer-change",
      fixedBuffer: plan.fixedBuffer + 2_500,
    };
  }

  if (scenarioKind === "adjust-savings") {
    const savingsGoal = plan.plannedRecords.savingsGoals[0];

    if (savingsGoal !== undefined) {
      return {
        kind: "savings-goal-change",
        savingsGoalId: savingsGoal.id,
        status: "paused",
      };
    }

    return {
      kind: "buffer-change",
      fixedBuffer: Math.max(0, plan.fixedBuffer - 2_500),
    };
  }

  return {
    kind: "one-time-spend",
    id: "scenario_extra_spend",
    date: today,
    amount: 2_500,
    note: "What-if extra spending",
  };
}

function scenarioCardClass(selected: boolean): string {
  return selected ? "scenario-card scenario-card-selected" : "scenario-card";
}

function simulatorWarningSummary(
  warnings: readonly BudgetWarning[],
  currency: CurrencyMetadata,
): string {
  if (warnings.length === 0) {
    return "No warnings for this result.";
  }

  return warnings
    .map((warning) => budgetWarningCopy(warning, currency).headline)
    .join(", ");
}

interface PeriodRolloverPanelProps {
  plan: BudgetPlan;
  openingBalance: Money;
  repository?: BudgetPlanRepository;
  services: ApplicationServices;
  today: DateOnly;
  onPlanChange: (plan: BudgetPlan) => void;
}

function PeriodRolloverPanel({
  plan,
  openingBalance,
  repository,
  services,
  today,
  onPlanChange,
}: PeriodRolloverPanelProps) {
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const nextPeriod = suggestNextActivePeriod(plan);
  const endedPeriodLabel = periodLabel(plan.activePeriod);
  const periodIsEndingToday = today === plan.activePeriod.endDate;

  async function submitRollover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (repository === undefined) {
      setErrorMessage("Budget storage is not ready. Try again in a moment.");
      return;
    }

    try {
      const completion = await completePeriodRollover(
        {
          plan,
          confirmedAvailableMoney: parseMoneyInput(
            stringField(new FormData(event.currentTarget), "opening-balance"),
            plan.currency,
            "Opening balance",
          ),
        },
        {
          repository,
          services,
        },
      );

      setErrorMessage(undefined);
      onPlanChange(completion.plan);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Check the opening balance.",
      );
    }
  }

  return (
    <section className="rollover-panel" aria-labelledby="rollover-title">
      <p className="section-kicker">
        {periodIsEndingToday ? "Period ending today" : "Period ended"}
      </p>
      <h2 id="rollover-title">Ready to roll this period forward</h2>
      <p className="rollover-copy">Review {endedPeriodLabel}</p>
      <dl>
        <div>
          <dt>Ending available money</dt>
          <dd>{formatMoney(openingBalance, plan.currency)}</dd>
        </div>
        <div>
          <dt>Spending logged</dt>
          <dd>
            {formatMoney(calculateSpendingLoggedThisPeriod(plan), plan.currency)}
          </dd>
        </div>
      </dl>
      <form
        className="rollover-form"
        aria-label="Rollover confirmation"
        onSubmit={submitRollover}
      >
        <label>
          Opening balance for the next period
          <input
            defaultValue={moneyInputValue(openingBalance, plan.currency)}
            inputMode="decimal"
            name="opening-balance"
          />
        </label>
        {errorMessage === undefined ? null : (
          <p className="validation-message" role="alert">
            {errorMessage}
          </p>
        )}
        <p>Rollover is optional until you confirm it.</p>
        <p>
          This creates {periodLabel(nextPeriod)}. Your {endedPeriodLabel} history
          will be kept as a period snapshot.
        </p>
        <button className="button button-primary" type="submit">
          Roll forward
        </button>
      </form>
    </section>
  );
}

interface PeriodHistoryPanelProps {
  currency: CurrencyMetadata;
  snapshots?: readonly PeriodSnapshot[];
}

function PeriodHistoryPanel({
  currency,
  snapshots = [],
}: PeriodHistoryPanelProps) {
  if (snapshots.length === 0) {
    return null;
  }

  return (
    <section className="period-history-panel" aria-labelledby="period-history-title">
      <p className="section-kicker">History kept as snapshots</p>
      <h2 id="period-history-title">Previous periods</h2>
      <div className="period-history-list">
        {snapshots.map((snapshot) => (
          <article className="period-history-card" key={snapshot.id}>
            <h3>{periodLabel(snapshot.period)}</h3>
            <dl>
              <div>
                <dt>Ending available money</dt>
                <dd>
                  {formatMoney(snapshot.endingEffectiveAvailableMoney, currency)}
                </dd>
              </div>
              <div>
                <dt>Spent</dt>
                <dd>{formatMoney(snapshot.totalSpending, currency)}</dd>
              </div>
              <div>
                <dt>Commitments paid</dt>
                <dd>{formatMoney(snapshot.totalCommitmentsPaid, currency)}</dd>
              </div>
              <div>
                <dt>Savings contributed</dt>
                <dd>{formatMoney(snapshot.totalSavingsContributions, currency)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function DailyActionPanel({
  onPlanChange,
  plan,
  repository,
  services,
  today,
}: {
  onPlanChange: (plan: BudgetPlan) => void;
  plan: BudgetPlan;
  repository?: BudgetPlanRepository;
  services: ApplicationServices;
  today: DateOnly;
}) {
  const [message, setMessage] = useState<string | undefined>();

  async function saveAction(
    action: Parameters<typeof performDailyAction>[1],
  ): Promise<void> {
    if (repository === undefined) {
      setMessage("Budget storage is not ready. Try again in a moment.");
      return;
    }

    try {
      const completion = await performDailyAction(plan, action, {
        repository,
        services,
        today,
      });

      setMessage("Daily check-in saved.");
      onPlanChange(completion.plan);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Check the activity details.",
      );
    }
  }

  async function submitSpending(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await saveAction({
      kind: "log-spending",
      amount: stringField(formData, "spending-amount"),
      categoryId: optionalStringField(formData, "spending-category"),
      note: optionalStringField(formData, "spending-note"),
      date: requiredFormString(formData, "spending-date"),
    });
  }

  async function submitBalance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await saveAction({
      kind: "update-balance",
      amount: stringField(formData, "balance-amount"),
      note: optionalStringField(formData, "balance-note"),
      date: requiredFormString(formData, "balance-date"),
    });
  }

  async function submitIncome(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await saveAction({
      kind: "confirm-income",
      amount: stringField(formData, "income-amount"),
      incomeTemplateId: optionalStringField(formData, "income-template"),
      note: optionalStringField(formData, "income-note"),
      date: requiredFormString(formData, "income-date"),
    });
  }

  async function submitSavings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const savingsGoalId = requiredFormString(formData, "savings-goal");

    await saveAction({
      kind: "record-savings-contribution",
      amount: stringField(formData, "savings-amount"),
      savingsGoalId,
      note: optionalStringField(formData, "savings-note"),
      date: requiredFormString(formData, "savings-date"),
    });
  }

  async function undoLastAction(): Promise<void> {
    if (repository === undefined) {
      setMessage("Budget storage is not ready. Try again in a moment.");
      return;
    }

    if (!window.confirm("Undo the latest activity and recalculate your budget?")) {
      return;
    }

    try {
      const completion = await undoLastDailyActivity(plan, {
        repository,
        services,
        today,
      });

      setMessage("Latest activity undone.");
      onPlanChange(completion.plan);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nothing to undo.");
    }
  }

  async function correctActivity(activity: DailyActivityListItem): Promise<void> {
    if (repository === undefined) {
      setMessage("Budget storage is not ready. Try again in a moment.");
      return;
    }

    if (activity.source !== "financial-event") {
      setMessage("Balance updates can be corrected by recording a new balance.");
      return;
    }

    const amount = window.prompt(
      "Correct the amount for this activity.",
      formatMoney(activity.amount, plan.currency),
    );

    if (amount === null) {
      return;
    }

    const note = window.prompt("Correct the note for this activity.", activity.label);

    try {
      const completion = await correctDailyActivity(
        plan,
        {
          kind: "financial-event",
          id: activity.id,
          amount,
          note: note ?? activity.label,
        },
        {
          repository,
          services,
          today,
        },
      );

      setMessage("Activity corrected.");
      onPlanChange(completion.plan);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Check the correction details.",
      );
    }
  }

  async function deleteActivity(activity: DailyActivityListItem): Promise<void> {
    if (repository === undefined) {
      setMessage("Budget storage is not ready. Try again in a moment.");
      return;
    }

    if (activity.source !== "financial-event") {
      setMessage("Balance updates can be corrected by recording a new balance.");
      return;
    }

    if (!window.confirm("Delete this activity and recalculate your budget?")) {
      return;
    }

    try {
      const completion = await deleteDailyActivity(
        plan,
        {
          kind: "financial-event",
          id: activity.id,
        },
        {
          repository,
          services,
          today,
        },
      );

      setMessage("Activity deleted.");
      onPlanChange(completion.plan);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete activity.");
    }
  }

  return (
    <section
      className="workflow-panel daily-actions-panel"
      aria-labelledby="daily-actions-title"
    >
      <div className="panel-heading daily-actions-heading">
        <div>
          <p className="section-kicker">Daily check-in</p>
          <h2 id="daily-actions-title">Log spending</h2>
        </div>
        <button className="button button-primary" form="log-spending-form" type="submit">
          Log spending
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => void undoLastAction()}
        >
          Undo last action
        </button>
      </div>

      {message === undefined ? null : (
        <p className="validation-message" role="status">
          {message}
        </p>
      )}

      <form
        className="workflow-form daily-action-form"
        id="log-spending-form"
        aria-label="Log spending"
        onSubmit={(event) => void submitSpending(event)}
      >
        <label>
          Amount
          <input inputMode="decimal" name="spending-amount" placeholder="$25.00" required />
        </label>
        <label>
          Category
          <select name="spending-category" defaultValue="">
            <option value="">No category</option>
            {plan.plannedRecords.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Note
          <input name="spending-note" placeholder="Groceries" />
        </label>
        <label>
          Date
          <input defaultValue={today} name="spending-date" type="date" required />
        </label>
      </form>

      <form
        className="workflow-form daily-action-form"
        aria-label="Update current balance"
        onSubmit={(event) => void submitBalance(event)}
      >
        <h3>Update current balance</h3>
        <label>
          Amount
          <input inputMode="decimal" name="balance-amount" placeholder="$800.00" required />
        </label>
        <label>
          Note
          <input name="balance-note" placeholder="Checked bank balance" />
        </label>
        <label>
          Date
          <input defaultValue={today} name="balance-date" type="date" required />
        </label>
        <button className="button button-secondary" type="submit">
          Save balance
        </button>
      </form>

      {plan.plannedRecords.incomeTemplates.length === 0 ? null : (
        <form
          className="workflow-form daily-action-form"
          aria-label="Confirm income"
          onSubmit={(event) => void submitIncome(event)}
        >
          <h3>Confirm income</h3>
          <label>
            Amount
            <input inputMode="decimal" name="income-amount" placeholder="$120.00" required />
          </label>
          <label>
            Income source
            <select name="income-template" defaultValue="">
              <option value="">Choose income</option>
              {plan.plannedRecords.incomeTemplates.map((income) => (
                <option key={income.id} value={income.id}>
                  {income.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Note
            <input name="income-note" placeholder="Paycheck" />
          </label>
          <label>
            Date
            <input defaultValue={today} name="income-date" type="date" required />
          </label>
          <button className="button button-secondary" type="submit">
            Save income
          </button>
        </form>
      )}

      {plan.plannedRecords.savingsGoals.length === 0 ? null : (
        <form
          className="workflow-form daily-action-form"
          aria-label="Record savings contribution"
          onSubmit={(event) => void submitSavings(event)}
        >
          <h3>Record savings contribution</h3>
          <label>
            Amount
            <input inputMode="decimal" name="savings-amount" placeholder="$50.00" required />
          </label>
          <label>
            Savings goal
            <select name="savings-goal" defaultValue="" required>
              <option value="">Choose goal</option>
              {plan.plannedRecords.savingsGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Note
            <input name="savings-note" placeholder="Emergency fund" />
          </label>
          <label>
            Date
            <input defaultValue={today} name="savings-date" type="date" required />
          </label>
          <button className="button button-secondary" type="submit">
            Save savings
          </button>
        </form>
      )}

      <RecentActivity
        onCorrect={(activity) => void correctActivity(activity)}
        onDelete={(activity) => void deleteActivity(activity)}
        plan={plan}
      />
    </section>
  );
}

function RecentActivity({
  onCorrect,
  onDelete,
  plan,
}: {
  onCorrect: (activity: DailyActivityListItem) => void;
  onDelete: (activity: DailyActivityListItem) => void;
  plan: BudgetPlan;
}) {
  const activities = [
    ...plan.financialEvents.map((event) => financialEventActivity(event, plan)),
    ...plan.balanceSnapshots.map(balanceSnapshotActivity),
  ]
    .sort(compareActivitiesNewestFirst)
    .slice(0, 5);

  return (
    <section className="recent-activity" aria-labelledby="recent-activity-title">
      <h3 id="recent-activity-title">Recent activity</h3>
      {activities.length === 0 ? (
        <p>No activity logged yet.</p>
      ) : (
        <ul>
          {activities.map((activity) => (
            <li key={activity.id}>
              <span>{activity.label}</span>
              <strong>{formatMoney(activity.amount, plan.currency)}</strong>
              {activity.source === "financial-event" ? (
                <>
                  <button
                    className="text-button activity-action"
                    type="button"
                    onClick={() => onCorrect(activity)}
                  >
                    Correct activity
                  </button>
                  <button
                    className="text-button activity-action"
                    type="button"
                    onClick={() => onDelete(activity)}
                  >
                    Delete activity
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface DailyActivityListItem {
  id: string;
  source: "financial-event" | "balance-snapshot";
  date: DateOnly;
  createdAt: string;
  label: string;
  amount: Money;
}

function compareActivitiesNewestFirst(
  left: DailyActivityListItem,
  right: DailyActivityListItem,
): number {
  if (left.date !== right.date) {
    return right.date.localeCompare(left.date);
  }

  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function financialEventActivity(
  event: FinancialEventRecord,
  plan: BudgetPlan,
): DailyActivityListItem {
  if (event.note !== undefined) {
    return {
      id: event.id,
      source: "financial-event",
      date: event.date,
      createdAt: event.createdAt,
      label: event.note,
      amount: event.amount,
    };
  }

  if (event.categoryId !== undefined) {
    return {
      id: event.id,
      source: "financial-event",
      date: event.date,
      createdAt: event.createdAt,
      label:
        plan.plannedRecords.categories.find(
          (category) => category.id === event.categoryId,
        )?.name ?? "Spending",
      amount: event.amount,
    };
  }

  if (event.incomeTemplateId !== undefined) {
    return {
      id: event.id,
      source: "financial-event",
      date: event.date,
      createdAt: event.createdAt,
      label:
        plan.plannedRecords.incomeTemplates.find(
          (income) => income.id === event.incomeTemplateId,
        )?.name ?? "Income received",
      amount: event.amount,
    };
  }

  if (event.savingsGoalId !== undefined) {
    return {
      id: event.id,
      source: "financial-event",
      date: event.date,
      createdAt: event.createdAt,
      label:
        plan.plannedRecords.savingsGoals.find(
          (goal) => goal.id === event.savingsGoalId,
        )?.name ?? "Savings contribution",
      amount: event.amount,
    };
  }

  return {
    id: event.id,
    source: "financial-event",
    date: event.date,
    createdAt: event.createdAt,
    label: "Spending",
    amount: event.amount,
  };
}

function balanceSnapshotActivity(
  snapshot: BalanceSnapshot,
): DailyActivityListItem {
  return {
    id: snapshot.id,
    source: "balance-snapshot",
    date: snapshot.date,
    createdAt: snapshot.createdAt,
    label: snapshot.note ?? "Current balance update",
    amount: snapshot.amount,
  };
}

interface SavingsGoalsPanelProps {
  allocations: ReturnType<typeof calculateSavingsGoalAllocations>;
  currency: CurrencyMetadata;
  plan: BudgetPlan;
  services: ApplicationServices;
  today: DateOnly;
  onPlanChange: (plan: BudgetPlan) => void;
}

function SavingsGoalsPanel({
  allocations,
  currency,
  plan,
  services,
  today,
  onPlanChange,
}: SavingsGoalsPanelProps) {
  const money = (amount: Money) => formatMoney(amount, currency);

  function createGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const protectedValue = formData.get("goal-protected") === "on";

    onPlanChange(
      addSavingsGoal(
        plan,
        {
          name: requiredFormString(formData, "goal-name"),
          targetAmount: parseDashboardMoney(
            requiredFormString(formData, "goal-target"),
            currency,
            "Target amount",
          ),
          currentAmount: parseDashboardMoney(
            formString(formData, "goal-current") || "0",
            currency,
            "Current saved amount",
          ),
          targetDate: optionalFormString(formData, "goal-target-date"),
          protected: protectedValue,
          periodContributionOverride: optionalMoneyField(
            formData,
            "goal-period-contribution",
            currency,
            "Period contribution",
          ),
        },
        services,
      ),
    );
    event.currentTarget.reset();
  }

  function saveGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    onPlanChange(
      updateSavingsGoal(
        plan,
        {
          savingsGoalId: requiredFormString(formData, "savings-goal-id"),
          name: requiredFormString(formData, "goal-name"),
          targetAmount: parseDashboardMoney(
            requiredFormString(formData, "goal-target"),
            currency,
            "Target amount",
          ),
          currentAmount: parseDashboardMoney(
            requiredFormString(formData, "goal-current"),
            currency,
            "Current saved amount",
          ),
          targetDate: optionalFormString(formData, "goal-target-date"),
          protected: formData.get("goal-protected") === "on",
          periodContributionOverride: optionalMoneyField(
            formData,
            "goal-period-contribution",
            currency,
            "Period contribution",
          ),
        },
        services,
      ),
    );
  }

  function setGoalStatus(goalId: string, status: SavingsGoalStatus) {
    onPlanChange(
      updateSavingsGoal(
        plan,
        {
          savingsGoalId: goalId,
          status,
        },
        services,
      ),
    );
  }

  function recordContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    onPlanChange(
      recordSavingsContribution(
        plan,
        {
          savingsGoalId: requiredFormString(formData, "contribution-goal-id"),
          date: optionalFormString(formData, "contribution-date") ?? today,
          amount: parseDashboardMoney(
            requiredFormString(formData, "contribution-amount"),
            currency,
            "Contribution amount",
          ),
          note: optionalFormString(formData, "contribution-note"),
        },
        services,
      ),
    );
    event.currentTarget.reset();
  }

  return (
    <section className="workflow-panel" aria-labelledby="savings-goals-title">
      <div className="workflow-heading">
        <p className="section-kicker">Savings workflow</p>
        <h2 id="savings-goals-title">Savings goals</h2>
        <p>
          Protected savings means set this money aside before calculating what I can spend.
          Turning protection off makes the goal informational only.
        </p>
      </div>

      <form className="workflow-form" aria-label="Create savings goal" onSubmit={createGoal}>
        <label>
          Goal name
          <input name="goal-name" required />
        </label>
        <label>
          Target amount
          <input inputMode="decimal" name="goal-target" required />
        </label>
        <label>
          Current saved amount
          <input defaultValue="0" inputMode="decimal" name="goal-current" />
        </label>
        <label>
          Target date
          <input name="goal-target-date" type="date" />
        </label>
        <label>
          Period contribution
          <input inputMode="decimal" name="goal-period-contribution" />
        </label>
        <label className="inline-choice">
          <input defaultChecked name="goal-protected" type="checkbox" />
          Protected
        </label>
        <button className="button button-primary" type="submit">
          Create savings goal
        </button>
      </form>

      {plan.plannedRecords.savingsGoals.length === 0 ? (
        <p className="empty-workflow-note">
          Add a protected goal when you want savings reflected before spending.
        </p>
      ) : (
        <div className="goal-list">
          {plan.plannedRecords.savingsGoals.map((goal) => {
            const allocation = allocations.find(
              (candidate) => candidate.goalId === goal.id,
            );

            return (
              <article className="goal-row" key={goal.id}>
                <div>
                  <h3>{goal.name}</h3>
                  <p>
                    {goal.protected ? "Protected" : "Informational only"} - {goal.status}
                  </p>
                  {allocation === undefined ? null : (
                    <dl className="mini-metrics">
                      <div>
                        <dt>Progress</dt>
                        <dd>{money(allocation.progressAmount)}</dd>
                      </div>
                      <div>
                        <dt>Remaining</dt>
                        <dd>{money(allocation.remainingAmount)}</dd>
                      </div>
                      <div>
                        <dt>Protected this period</dt>
                        <dd>{money(allocation.remainingProtectedDeduction)}</dd>
                      </div>
                    </dl>
                  )}
                </div>

                <form className="workflow-form compact-form" onSubmit={saveGoal}>
                  <input name="savings-goal-id" type="hidden" value={goal.id} />
                  <label>
                    Goal name
                    <input name="goal-name" defaultValue={goal.name} required />
                  </label>
                  <label>
                    Target amount
                    <input
                      inputMode="decimal"
                      name="goal-target"
                      defaultValue={moneyInputValue(goal.targetAmount, currency)}
                      required
                    />
                  </label>
                  <label>
                    Current saved amount
                    <input
                      inputMode="decimal"
                      name="goal-current"
                      defaultValue={moneyInputValue(goal.currentAmount, currency)}
                      required
                    />
                  </label>
                  <label>
                    Target date
                    <input
                      name="goal-target-date"
                      type="date"
                      defaultValue={goal.targetDate ?? ""}
                    />
                  </label>
                  <label>
                    Period contribution
                    <input
                      inputMode="decimal"
                      name="goal-period-contribution"
                      defaultValue={
                        goal.periodContributionOverride === undefined
                          ? ""
                          : moneyInputValue(goal.periodContributionOverride, currency)
                      }
                    />
                  </label>
                  <label className="inline-choice">
                    <input
                      defaultChecked={goal.protected}
                      name="goal-protected"
                      type="checkbox"
                    />
                    Protected
                  </label>
                  <button className="button button-secondary" type="submit">
                    Save goal changes
                  </button>
                </form>

                <div className="action-row" aria-label={`${goal.name} status actions`}>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() =>
                      setGoalStatus(
                        goal.id,
                        goal.status === "paused" ? "active" : "paused",
                      )
                    }
                  >
                    {goal.status === "paused" ? "Resume goal" : "Pause goal"}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setGoalStatus(goal.id, "completed")}
                  >
                    Complete goal
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setGoalStatus(goal.id, "archived")}
                  >
                    Archive goal
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <form
        className="workflow-form contribution-form"
        aria-label="Record savings contribution"
        onSubmit={recordContribution}
      >
        <label>
          Amount
          <input inputMode="decimal" name="contribution-amount" required />
        </label>
        <label>
          Savings goal
          <select name="contribution-goal-id" required>
            {plan.plannedRecords.savingsGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input defaultValue={today} name="contribution-date" type="date" />
        </label>
        <label>
          Note
          <input name="contribution-note" />
        </label>
        <button className="button button-primary" type="submit">
          Record contribution
        </button>
      </form>
    </section>
  );
}

interface CategoryGuidancePanelProps {
  categorySummaries: readonly CategorySummary[];
  currency: CurrencyMetadata;
  plan: BudgetPlan;
  services: ApplicationServices;
  onPlanChange: (plan: BudgetPlan) => void;
}

function CategoryGuidancePanel({
  categorySummaries,
  currency,
  plan,
  services,
  onPlanChange,
}: CategoryGuidancePanelProps) {
  const money = (amount: Money) => formatMoney(amount, currency);

  function createCustomCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    onPlanChange(
      addCustomCategory(
        plan,
        {
          name: requiredFormString(formData, "custom-category-name"),
        },
        services,
      ),
    );
    event.currentTarget.reset();
  }

  function saveGuidance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    onPlanChange(
      setFlexibleCategoryGuidance(
        plan,
        {
          categoryId: requiredFormString(formData, "guidance-category-id"),
          periodLimit: parseDashboardMoney(
            requiredFormString(formData, "guidance-period-limit"),
            currency,
            "Guidance amount",
          ),
        },
        services,
      ),
    );
    event.currentTarget.reset();
  }

  return (
    <section className="workflow-panel" aria-labelledby="category-guidance-title">
      <div className="workflow-heading">
        <p className="section-kicker">Spending patterns</p>
        <h2 id="category-guidance-title">Category guidance</h2>
        <p>
          Optional visual guidance helps you compare spending patterns and does not reduce safe-to-spend.
        </p>
      </div>

      <div className="category-list" aria-label="Category guidance summaries">
        {plan.plannedRecords.categories.map((category) => {
          const summary = categorySummaries.find(
            (candidate) => candidate.categoryId === category.id,
          );
          const limit = summary?.periodLimit;
          const spentAmount = summary?.spentAmount ?? 0;
          const progress =
            limit === undefined || limit === 0
              ? 0
              : Math.min(100, Math.round((spentAmount / limit) * 100));

          return (
            <article className="category-row" key={category.id}>
              <div>
                <h3>{category.name}</h3>
                <p>{category.kind === "custom" ? "Custom category" : "Default category"}</p>
              </div>
              <div className="guidance-meter" aria-label={`${category.name} guidance`}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>
                {money(spentAmount)}
                {limit === undefined ? " spent" : ` of ${money(limit)} guidance`}
              </p>
            </article>
          );
        })}
      </div>

      <form
        className="workflow-form"
        aria-label="Add custom category"
        onSubmit={createCustomCategory}
      >
        <label>
          Custom category name
          <input name="custom-category-name" required />
        </label>
        <button className="button button-secondary" type="submit">
          Add custom category
        </button>
      </form>

      <form
        className="workflow-form"
        aria-label="Set category guidance"
        onSubmit={saveGuidance}
      >
        <label>
          Category
          <select name="guidance-category-id" required>
            {plan.plannedRecords.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Period guidance amount
          <input inputMode="decimal" name="guidance-period-limit" required />
        </label>
        <button className="button button-secondary" type="submit">
          Set guidance
        </button>
      </form>
    </section>
  );
}

interface CommitmentCardProps {
  commitment: CommitmentOccurrence;
  currency: CurrencyMetadata;
  paymentHistory: readonly FinancialEventRecord[];
  template?: CommitmentTemplate;
  onFullPayment: () => void;
  onPartialPayment: (event: React.FormEvent<HTMLFormElement>) => void;
}

function CommitmentCard({
  commitment,
  currency,
  paymentHistory,
  template,
  onFullPayment,
  onPartialPayment,
}: CommitmentCardProps) {
  const money = (amount: Money) => formatMoney(amount, currency);
  const dueContext = commitmentDueContext(commitment);

  return (
    <article className="commitment-card">
      <div>
        <p className={`commitment-timing commitment-timing-${commitment.timing}`}>
          {dueContext}
        </p>
        <h3>{commitment.name}</h3>
        <p className="commitment-context">
          {recurrenceContext(template, commitment)} · {money(commitment.amount)}
        </p>
      </div>
      <div className="commitment-progress" aria-label={`${commitment.name} payment progress`}>
        <p>
          {money(commitment.paidAmount)} paid of {money(commitment.amount)}
        </p>
        <strong>{money(commitment.remainingUnpaidAmount)} remaining</strong>
      </div>
      {paymentHistory.length === 0 ? null : (
        <div className="payment-history">
          <p>Payment history</p>
          <ul>
            {paymentHistory.map((payment) => (
              <li key={payment.id}>
                {formatShortDate(payment.date)} · {money(payment.amount)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {commitment.paid ? (
        <p className="commitment-paid">Paid in full</p>
      ) : (
        <div className="commitment-actions">
          <form onSubmit={onPartialPayment}>
            <label>
              Partial payment
              <input inputMode="decimal" name="partial-payment" required />
            </label>
            <button className="button button-secondary" type="submit">
              Record partial payment
            </button>
          </form>
          <button
            className="button button-primary"
            type="button"
            onClick={onFullPayment}
          >
            Mark paid in full
          </button>
        </div>
      )}
    </article>
  );
}

function paymentHistoryForCommitment(
  events: readonly FinancialEventRecord[],
  commitment: CommitmentOccurrence,
): FinancialEventRecord[] {
  return events.filter(
    (event) =>
      event.kind === "commitment-payment" &&
      event.commitmentTemplateId === commitment.templateId &&
      event.occurrenceDate === commitment.date,
  );
}

function commitmentDueContext(commitment: CommitmentOccurrence): string {
  if (commitment.timing === "overdue") {
    return "Overdue";
  }

  if (commitment.timing === "due-today") {
    return "Due today";
  }

  return `Due ${formatShortDate(commitment.date)}`;
}

function recurrenceContext(
  template: CommitmentTemplate | undefined,
  commitment: CommitmentOccurrence,
): string {
  const frequency = template?.recurrence.frequency ?? "one-time";
  const recurrence =
    frequency === "one-time"
      ? "One-time"
      : frequency === "biweekly"
        ? "Biweekly"
        : `${frequency.charAt(0).toUpperCase()}${frequency.slice(1)}`;

  return `${recurrence} ${commitment.kind}`;
}

function commitmentDraftFromForm(
  formData: FormData,
  currency: CurrencyMetadata,
): CommitmentTemplateDraft {
  const dueDate = stringField(formData, "commitment-due-date");
  const frequency = recurrenceFrequencyField(formData, "commitment-recurrence");
  const shortcut = stringField(formData, "commitment-type");
  const customName = optionalStringField(formData, "commitment-name");
  const name = shortcut === "Custom" ? customName ?? "Custom commitment" : shortcut;
  const recurrence = recurrenceRuleForDueDate(frequency, dueDate);

  return {
    name,
    kind: shortcut === "EMI" ? "debt" : "bill",
    amount: parseMoneyForCurrency(
      stringField(formData, "commitment-amount"),
      currency,
      `${name} amount`,
    ),
    active: true,
    startsOn: dueDate,
    recurrence,
  };
}

function recurrenceFrequencyField(
  formData: FormData,
  name: string,
): RecurrenceFrequency {
  const value = stringField(formData, name);

  if (
    value === "one-time" ||
    value === "weekly" ||
    value === "biweekly" ||
    value === "monthly" ||
    value === "yearly"
  ) {
    return value;
  }

  return "one-time";
}

function recurrenceRuleForDueDate(
  frequency: RecurrenceFrequency,
  dueDate: DateOnly,
): RecurrenceRule {
  const day = dayParts(dueDate);
  const rule: RecurrenceRule = {
    frequency,
    interval: 1,
    anchorDate: dueDate,
  };

  if (frequency === "monthly") {
    rule.monthly = {
      dayOfMonth: day.dayOfMonth,
      missingDayBehavior: "last-valid-day",
    };
  }

  if (frequency === "yearly") {
    rule.yearly = {
      month: day.month,
      dayOfMonth: day.dayOfMonth,
      missingDayBehavior: "last-valid-day",
    };
  }

  return rule;
}

interface ReminderPanelProps {
  commitments: readonly CommitmentOccurrence[];
  notificationAdapter: BrowserNotificationAdapter;
  onPreferencesChange: (preferences: ReminderPreferences) => void;
  preferences?: ReminderPreferences;
}

function ReminderPanel({
  commitments,
  notificationAdapter,
  onPreferencesChange,
  preferences,
}: ReminderPanelProps) {
  const reminderPreferences = preferences ?? defaultReminderPreferences();
  const dueItemReminders = reminderPreferences.dueItemRemindersEnabled
    ? commitments.filter(
        (commitment) =>
          !commitment.paid &&
          (commitment.timing === "overdue" ||
            commitment.timing === "due-today"),
      )
    : [];
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>(
      notificationAdapter.permissionStatus(),
    );

  async function requestBrowserNotifications() {
    setPermissionStatus(await notificationAdapter.requestPermission());
  }

  function submitReminderSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    onPreferencesChange({
      dailyCheckInEnabled: formData.get("daily-check-in") === "on",
      dailyCheckInTime: stringField(formData, "daily-check-in-time") || "18:00",
      dueItemRemindersEnabled: formData.get("due-item-reminders") === "on",
      browserNotificationsEnabled: permissionStatus === "granted",
    });
  }

  return (
    <section className="workflow-panel reminders-panel" aria-labelledby="reminders-title">
      <div className="workflow-heading">
        <p className="section-kicker">Reminders</p>
        <h2 id="reminders-title">Check-in reminders</h2>
        <p>
          In-app reminders stay available in this budget. Browser notifications are optional and depend on this browser.
        </p>
      </div>

      <form
        className="workflow-form"
        aria-label="Reminder settings"
        onSubmit={submitReminderSettings}
      >
        <label className="inline-choice">
          <input
            defaultChecked={reminderPreferences.dailyCheckInEnabled}
            name="daily-check-in"
            type="checkbox"
          />
          Daily check-in
        </label>
        <label>
          Check-in time
          <input
            defaultValue={reminderPreferences.dailyCheckInTime}
            name="daily-check-in-time"
            type="time"
          />
        </label>
        <label className="inline-choice">
          <input
            defaultChecked={reminderPreferences.dueItemRemindersEnabled}
            name="due-item-reminders"
            type="checkbox"
          />
          Due-item reminders
        </label>
        <label>
          Due-item timing
          <select name="due-item-timing" defaultValue="due-and-overdue">
            <option value="due-and-overdue">Due today and overdue</option>
            <option value="overdue">Overdue only</option>
          </select>
        </label>
        <button className="button button-secondary" type="submit">
          Save reminder settings
        </button>
      </form>

      <div className="reminder-summary" aria-label="Saved reminder choices">
        <p>
          {reminderPreferences.dailyCheckInEnabled
            ? "Daily check-in on"
            : "Daily check-in off"}
        </p>
        <p>
          {reminderPreferences.dueItemRemindersEnabled
            ? "Due-item reminders on"
            : "Due-item reminders off"}
        </p>
      </div>

      {dueItemReminders.length === 0 ? null : (
        <div className="in-app-reminders" aria-label="In-app reminders">
          <h3>In-app reminders</h3>
          <ul>
            {dueItemReminders.map((commitment) => (
              <li key={commitment.id}>{dueItemReminderCopy(commitment)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="notification-status">
        <h3>Browser notifications</h3>
        <p>{notificationPermissionCopy(permissionStatus)}</p>
        {permissionStatus === "default" ? (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void requestBrowserNotifications()}
          >
            Enable browser notifications
          </button>
        ) : null}
      </div>
    </section>
  );
}

function defaultReminderPreferences(): ReminderPreferences {
  return {
    dailyCheckInEnabled: true,
    dailyCheckInTime: "18:00",
    dueItemRemindersEnabled: true,
    browserNotificationsEnabled: false,
  };
}

function dueItemReminderCopy(commitment: CommitmentOccurrence): string {
  if (commitment.timing === "overdue") {
    return `Reminder: ${commitment.name} is overdue`;
  }

  return `Reminder: ${commitment.name} is due today`;
}

function notificationPermissionCopy(
  permissionStatus: NotificationPermissionStatus,
): string {
  if (permissionStatus === "granted") {
    return "Browser notifications are enabled for supported reminders.";
  }

  if (permissionStatus === "denied") {
    return "Browser notifications are blocked. In-app reminders still work while this budget is open.";
  }

  if (permissionStatus === "default") {
    return "You can enable browser notifications from this reminder setting after creating a budget.";
  }

  return "Browser notifications are not supported here. In-app reminders still work while this budget is open.";
}

function dayParts(date: DateOnly): { month: number; dayOfMonth: number } {
  const [, month = "1", day = "1"] = date.split("-");

  return {
    month: Number(month),
    dayOfMonth: Number(day),
  };
}

function parseMoneyForCurrency(
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

function formatShortDate(date: DateOnly): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function periodLabel(period: { startDate: DateOnly; endDate: DateOnly }): string {
  return `${dateLabel(period.startDate)} to ${dateLabel(period.endDate)}`;
}

function dateLabel(date: DateOnly): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function budgetCouldUseRefinement(plan: BudgetPlan): boolean {
  return (
    plan.fixedBuffer === 0 &&
    plan.plannedRecords.commitmentTemplates.length === 0 &&
    plan.plannedRecords.savingsGoals.length === 0
  );
}

function requiredFormString(formData: FormData, name: string): string {
  const value = formString(formData, name).trim();

  if (value === "") {
    throw new RangeError(`${name} is required.`);
  }

  return value;
}

function optionalFormString(formData: FormData, name: string): string | undefined {
  const value = formString(formData, name).trim();

  return value === "" ? undefined : value;
}

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function optionalMoneyField(
  formData: FormData,
  name: string,
  currency: CurrencyMetadata,
  fieldName: string,
): Money | undefined {
  const value = optionalFormString(formData, name);

  return value === undefined
    ? undefined
    : parseDashboardMoney(value, currency, fieldName);
}

function parseDashboardMoney(
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

function moneyInputValue(amount: Money, currency: CurrencyMetadata): string {
  return (amount / 10 ** currency.decimalPlaces).toFixed(currency.decimalPlaces);
}

function rankedBudgetWarnings(
  warnings: readonly BudgetWarning[],
): BudgetWarning[] {
  return warnings
    .map((warning, index) => ({ warning, index }))
    .sort((left, right) => {
      const severityComparison =
        warningSeverityRank(right.warning) - warningSeverityRank(left.warning);

      if (severityComparison !== 0) {
        return severityComparison;
      }

      return left.index - right.index;
    })
    .map(({ warning }) => warning);
}

function warningSeverityRank(warning: BudgetWarning): number {
  if (warning.severity === "critical") {
    return 3;
  }

  if (warning.severity === "warning") {
    return 2;
  }

  return 1;
}

interface BudgetWarningCardProps {
  warning: BudgetWarning;
  currency: CurrencyMetadata;
  prominent?: boolean;
}

function BudgetWarningCard({
  warning,
  currency,
  prominent = false,
}: BudgetWarningCardProps) {
  const copy = budgetWarningCopy(warning, currency);

  return (
    <article
      className={[
        "warning-card",
        `warning-card-${warning.severity}`,
        prominent ? "warning-card-prominent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={prominent ? "status" : undefined}
    >
      {prominent ? <p className="warning-label">Top priority</p> : null}
      <p className="warning-severity">{warningSeverityLabel(warning)}</p>
      <h3>{copy.headline}</h3>
      <p>
        <strong>Situation:</strong> {copy.situation}
      </p>
      <p>
        <strong>Impact:</strong> {copy.impact}
      </p>
      <p>
        <strong>Next action:</strong> {copy.nextAction}
      </p>
      {copy.amount === undefined ? null : (
        <strong className="warning-amount">{copy.amount}</strong>
      )}
    </article>
  );
}

function budgetWarningCopy(
  warning: BudgetWarning,
  currency: CurrencyMetadata,
): {
  headline: string;
  situation: string;
  impact: string;
  nextAction: string;
  amount?: string;
} {
  const amount = warningAmount(warning);
  const formattedAmount =
    amount === undefined ? undefined : formatMoney(amount, currency);

  if (warning.code === "critical-shortfall") {
    return {
      headline: "Budget shortfall",
      situation: "Your protected money is larger than your available money.",
      impact: "Your safe-to-spend number is at zero until the shortfall is fixed.",
      nextAction:
        "Your plan is short before today's spending. Update your balance or reduce commitments before spending.",
      amount: formattedAmount,
    };
  }

  if (warning.code === "overdue-commitment") {
    return {
      headline: "A commitment is overdue",
      situation: "A bill or debt expected before today is still unpaid.",
      impact: "This money remains protected and should be handled before new spending.",
      nextAction: "Settle or update this overdue commitment before spending more.",
      amount: formattedAmount,
    };
  }

  if (warning.code === "commitment-due-today") {
    return {
      headline: "A commitment is due today",
      situation: "A bill or debt is due today.",
      impact: "The amount is still counted as spoken for in your safe-to-spend number.",
      nextAction: "Pay it, mark it paid, or adjust the commitment if it changed.",
      amount: formattedAmount,
    };
  }

  if (warning.code === "overdue-savings-goal") {
    return {
      headline: "A protected savings goal is overdue",
      situation: "A protected savings goal passed its target date unfinished.",
      impact: "The remaining planned contribution can make today's spending number too tight.",
      nextAction: "Review this goal so protected savings stay realistic.",
      amount: formattedAmount,
    };
  }

  return {
    headline: "Category spending is over guidance",
    situation: "Spending in this category is above the guidance you set.",
    impact: "This is a visual nudge only; it does not reduce safe-to-spend by itself.",
    nextAction:
      "Use this as guidance for the rest of the period; it does not reduce safe-to-spend by itself.",
    amount: formattedAmount,
  };
}

function warningSeverityLabel(warning: BudgetWarning): string {
  if (warning.severity === "critical") {
    return "Critical";
  }

  if (warning.severity === "warning") {
    return "Warning";
  }

  return "Guidance";
}

function warningAmount(warning: BudgetWarning): Money | undefined {
  const candidate =
    warning.metadata.shortfallAmount ??
    warning.metadata.remainingUnpaidAmount ??
    warning.metadata.remainingAmount ??
    warning.metadata.overageAmount;

  return typeof candidate === "number" ? candidate : undefined;
}

function EmptyDashboard({
  onStartBudgeting,
}: {
  onStartBudgeting: () => void;
}) {
  return (
    <main className="app-shell setup-shell">
      <section className="setup-header" aria-labelledby="empty-dashboard-title">
        <p className="eyebrow">No budget found</p>
        <h1 id="empty-dashboard-title">Set up your first budget</h1>
        <button
          className="button button-primary"
          type="button"
          onClick={onStartBudgeting}
        >
          Start budgeting
        </button>
      </section>
    </main>
  );
}

function createBrowserApplicationServices(): ApplicationServices {
  return {
    generateId: (prefix) => `${prefix}_${globalThis.crypto.randomUUID()}`,
    now: () => new Date().toISOString(),
  };
}

function currentDateOnly(): DateOnly {
  return new Date().toISOString().slice(0, 10);
}
