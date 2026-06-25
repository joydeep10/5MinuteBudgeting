import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, loadLandingResumeState } from "./app/App";
import "./app/App.css";
import { createIndexedDbBudgetPlanRepository } from "./infrastructure";

const root = createRoot(document.getElementById("root")!);

void renderApp();

async function renderApp(): Promise<void> {
  const repository = createIndexedDbBudgetPlanRepository({
    now: () => new Date().toISOString(),
  });
  const resumeState = await loadLandingResumeState(repository);

  root.render(
    <StrictMode>
      <App {...resumeState} />
    </StrictMode>,
  );
}
