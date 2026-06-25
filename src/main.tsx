import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, loadLandingResumeState } from "./app/App";
import type { ApplicationServices } from "./application";
import "./app/App.css";
import { createIndexedDbBudgetPlanRepository } from "./infrastructure";

const root = createRoot(document.getElementById("root")!);
const services: ApplicationServices = {
  generateId: (prefix) => `${prefix}_${globalThis.crypto.randomUUID()}`,
  now: () => new Date().toISOString(),
};

void renderApp();

async function renderApp(): Promise<void> {
  const repository = createIndexedDbBudgetPlanRepository({
    now: services.now,
  });
  const resumeState = await loadLandingResumeState(repository);

  root.render(
    <StrictMode>
      <App {...resumeState} repository={repository} services={services} />
    </StrictMode>,
  );
}
