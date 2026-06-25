export interface AppProps {
  hasSavedBudget?: boolean;
}

export interface LandingResumeSource {
  loadActivePlan: () => Promise<unknown | undefined>;
}

export async function loadLandingResumeState(
  source: LandingResumeSource,
): Promise<AppProps> {
  const savedBudget = await source.loadActivePlan();

  return {
    hasSavedBudget: savedBudget !== undefined,
  };
}

export function App({ hasSavedBudget = false }: AppProps) {
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
          <LandingActions hasSavedBudget={hasSavedBudget} />
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
        <LandingActions hasSavedBudget={hasSavedBudget} compact />
      </section>
    </main>
  );
}

interface LandingActionsProps {
  hasSavedBudget: boolean;
  compact?: boolean;
}

function LandingActions({
  hasSavedBudget,
  compact = false,
}: LandingActionsProps) {
  return (
    <div className={compact ? "hero-actions compact-actions" : "hero-actions"}>
      {hasSavedBudget ? (
        <>
          <a className="button button-primary" href="#budget">
            Open my budget
          </a>
          <button
            className="button button-secondary"
            type="button"
            aria-describedby="restart-protection"
            onClick={confirmStartNewBudget}
          >
            Start a new budget
          </button>
        </>
      ) : (
        <a className="button button-primary" href="#start-budgeting">
          Start budgeting
        </a>
      )}
    </div>
  );
}

function confirmStartNewBudget(): void {
  if (window.confirm("Start a new budget and replace this browser budget?")) {
    window.location.hash = "start-budgeting";
  }
}
