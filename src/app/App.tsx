import { useState } from "react";

import type { ApplicationServices } from "../application";
import { calculateSafeToSpend, calculateSpendingLoggedThisPeriod } from "../domain";
import type {
  BudgetMode,
  BudgetPlan,
  BudgetWarning,
  CurrencyMetadata,
  DateOnly,
  Money,
} from "../domain";
import {
  completeSetupWizard,
  estimateSetupWizardResult,
  formatMoney,
} from "../features/setupWizard";
import type {
  CommitmentShortcut,
  SetupWizardSubmission,
} from "../features/setupWizard";
import type { BudgetPlanRepository } from "../infrastructure";

export type AppView = "landing" | "setup" | "dashboard";

export interface AppProps {
  hasSavedBudget?: boolean;
  initialView?: AppView;
  initialPlan?: BudgetPlan;
  initialSetupSubmission?: Partial<SetupWizardSubmission>;
  repository?: BudgetPlanRepository;
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
      <Dashboard plan={plan} today={today} />
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
  today: DateOnly;
}

function Dashboard({ plan, today }: DashboardProps) {
  const result = calculateSafeToSpend({ plan, today });
  const money = (amount: Money) => formatMoney(amount, plan.currency);
  const spendingLoggedThisPeriod = calculateSpendingLoggedThisPeriod(plan);
  const shouldInviteRefinement = budgetCouldUseRefinement(plan);
  const warnings = rankedBudgetWarnings(result.warnings);
  const topWarning = warnings[0];
  const remainingWarnings = warnings.slice(1);

  return (
    <main className="app-shell dashboard-shell">
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <p className="eyebrow">Your first result</p>
        <h1 id="dashboard-title">Safe to spend today</h1>
        <p className="money-hero">{money(result.confirmed.safeToday)}</p>
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

      {shouldInviteRefinement ? (
        <section className="refinement-panel" aria-labelledby="refinement-title">
          <p className="section-kicker">Refine this budget</p>
          <h2 id="refinement-title">Ready when you are</h2>
          <p>
            Your budget is ready to use. Add commitments, protected savings, or a buffer when you want a sharper number.
          </p>
        </section>
      ) : null}

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

function budgetCouldUseRefinement(plan: BudgetPlan): boolean {
  return (
    plan.fixedBuffer === 0 &&
    plan.plannedRecords.commitmentTemplates.length === 0 &&
    plan.plannedRecords.savingsGoals.length === 0
  );
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
      <h3>{copy.headline}</h3>
      <p>{copy.action}</p>
      {copy.amount === undefined ? null : (
        <strong className="warning-amount">{copy.amount}</strong>
      )}
    </article>
  );
}

function budgetWarningCopy(
  warning: BudgetWarning,
  currency: CurrencyMetadata,
): { headline: string; action: string; amount?: string } {
  const amount = warningAmount(warning);
  const formattedAmount =
    amount === undefined ? undefined : formatMoney(amount, currency);

  if (warning.code === "critical-shortfall") {
    return {
      headline: "Budget shortfall",
      action:
        "Your plan is short before today's spending. Update your balance or reduce commitments before spending.",
      amount: formattedAmount,
    };
  }

  if (warning.code === "overdue-commitment") {
    return {
      headline: "A commitment is overdue",
      action: "Settle or update this overdue commitment before spending more.",
      amount: formattedAmount,
    };
  }

  if (warning.code === "commitment-due-today") {
    return {
      headline: "A commitment is due today",
      action: "Pay it, mark it paid, or adjust the commitment if it changed.",
      amount: formattedAmount,
    };
  }

  if (warning.code === "overdue-savings-goal") {
    return {
      headline: "A protected savings goal is overdue",
      action: "Review this goal so protected savings stay realistic.",
      amount: formattedAmount,
    };
  }

  return {
    headline: "Category spending is over guidance",
    action:
      "Use this as guidance for the rest of the period; it does not reduce safe-to-spend by itself.",
    amount: formattedAmount,
  };
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
