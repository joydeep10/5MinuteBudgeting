import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App, loadLandingResumeState } from "../src/app/App";

describe("landing page entry point", () => {
  it("shows new visitors the promise, dominant start CTA, and privacy trust signals", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Know what is safe to spend today");
    expect(html).toContain("Start budgeting");
    expect(html).toContain("No signup");
    expect(html).toContain("No bank connection");
    expect(html).toContain("Saved in this browser");
    expect(html).not.toContain("Open my budget");
  });

  it("shows returning visitors a dominant open-budget CTA and protected restart option", () => {
    const html = renderToStaticMarkup(<App hasSavedBudget />);

    expect(html).toContain("Open my budget");
    expect(html).toContain("Start a new budget");
    expect(html).toContain("You will confirm before replacing this browser budget");
  });

  it("hands locally saved budget data into the visible resume CTA state", async () => {
    const resumeState = await loadLandingResumeState({
      loadActivePlan: async () => ({ id: "saved-budget" }),
    });
    const html = renderToStaticMarkup(<App {...resumeState} />);

    expect(html).toContain("Open my budget");
    expect(html).toContain("Start a new budget");
    expect(html).not.toContain(">Start budgeting<");
  });

  it("explains the product, the setup path, privacy, and ends with a clear CTA", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("What it does");
    expect(html).toContain("How it works");
    expect(html).toContain("Private by design");
    expect(html).toContain("Start your 5-minute budget");
  });
});
