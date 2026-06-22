import { describe, expect, it } from "vitest";

import { createBudgetPlan } from "../src/application";
import { budgetPlanSchemaVersion } from "../src/domain";
import type { BudgetPlan, Money } from "../src/domain";
import {
  activeBudgetPlanStorageKey,
  createBudgetPlanRepository,
  exportBudgetPlanBackup,
  importBudgetPlanBackup,
  replaceActivePlanFromBackup,
} from "../src/infrastructure";
import type { BudgetPlanEnvelopeStore, StoredBudgetPlanEnvelope } from "../src/infrastructure";

const money = (minorUnits: number): Money => minorUnits;

const testPlan = (): BudgetPlan =>
  createBudgetPlan(
    {
      mode: "general",
      currency: {
        code: "USD",
        decimalPlaces: 2,
      },
      activePeriod: {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      fixedBuffer: money(10_000),
      startingAvailableMoney: money(125_000),
      defaultCategories: [
        {
          name: "Groceries",
          kind: "flexible",
        },
      ],
    },
    {
      generateId: (prefix) => `${prefix}_1`,
      now: () => "2026-06-01T08:00:00.000Z",
    },
  );

class InMemoryEnvelopeStore implements BudgetPlanEnvelopeStore {
  private envelope?: StoredBudgetPlanEnvelope;

  async read(key: string): Promise<StoredBudgetPlanEnvelope | undefined> {
    return this.envelope?.key === key ? structuredClone(this.envelope) : undefined;
  }

  async write(envelope: StoredBudgetPlanEnvelope): Promise<void> {
    this.envelope = structuredClone(envelope);
  }

  seed(envelope: StoredBudgetPlanEnvelope): void {
    this.envelope = structuredClone(envelope);
  }

  lastWritten(): StoredBudgetPlanEnvelope | undefined {
    return this.envelope;
  }
}

describe("BudgetPlan persistence and backup", () => {
  it("saves and loads the active BudgetPlan through a schema-versioned storage boundary", async () => {
    const store = new InMemoryEnvelopeStore();
    const repository = createBudgetPlanRepository({
      store,
      now: () => "2026-06-22T10:00:00.000Z",
    });
    const plan = testPlan();

    await repository.saveActivePlan(plan);

    expect(store.lastWritten()).toMatchObject({
      key: activeBudgetPlanStorageKey,
      schemaVersion: budgetPlanSchemaVersion,
      savedAt: "2026-06-22T10:00:00.000Z",
      plan,
    });
    await expect(repository.loadActivePlan()).resolves.toEqual(plan);
    await expect(repository.loadActivePlan()).resolves.not.toBe(plan);
  });

  it("exports and imports a compatible JSON backup for recovery", () => {
    const plan = testPlan();

    const backupJson = exportBudgetPlanBackup({
      plan,
      exportedAt: "2026-06-22T10:05:00.000Z",
    });

    expect(JSON.parse(backupJson)).toMatchObject({
      schemaVersion: budgetPlanSchemaVersion,
      exportedAt: "2026-06-22T10:05:00.000Z",
      plan,
    });
    expect(importBudgetPlanBackup(backupJson)).toEqual(plan);
    expect(importBudgetPlanBackup(backupJson)).not.toBe(plan);
  });

  it("rejects unsupported schema versions from stored data and backup files", async () => {
    const store = new InMemoryEnvelopeStore();
    const repository = createBudgetPlanRepository({
      store,
      now: () => "2026-06-22T10:10:00.000Z",
    });
    const plan = testPlan();
    await repository.saveActivePlan(plan);
    store.seed({
      ...store.lastWritten()!,
      schemaVersion: 999,
    });

    await expect(repository.loadActivePlan()).rejects.toThrow(/schema version/);
    expect(() =>
      importBudgetPlanBackup(
        JSON.stringify({
          schemaVersion: 999,
          exportedAt: "2026-06-22T10:11:00.000Z",
          plan,
        }),
      ),
    ).toThrow(/schema version/);
  });

  it("replaces the active plan from a compatible backup through an explicit flow", async () => {
    const store = new InMemoryEnvelopeStore();
    const repository = createBudgetPlanRepository({
      store,
      now: () => "2026-06-22T10:10:00.000Z",
    });
    const existingPlan = testPlan();
    const importedPlan = {
      ...testPlan(),
      id: "budget_imported",
      fixedBuffer: money(25_000),
    };
    const backupJson = exportBudgetPlanBackup({
      plan: importedPlan,
      exportedAt: "2026-06-22T10:11:00.000Z",
    });
    await repository.saveActivePlan(existingPlan);

    await expect(
      replaceActivePlanFromBackup({
        repository,
        backupJson,
      }),
    ).resolves.toEqual(importedPlan);
    await expect(repository.loadActivePlan()).resolves.toEqual(importedPlan);
  });

  it("rejects invalid backup replacement without overwriting the active plan", async () => {
    const store = new InMemoryEnvelopeStore();
    const repository = createBudgetPlanRepository({
      store,
      now: () => "2026-06-22T10:10:00.000Z",
    });
    const existingPlan = testPlan();
    const invalidBackupJson = JSON.stringify({
      schemaVersion: budgetPlanSchemaVersion,
      exportedAt: "2026-06-22T10:11:00.000Z",
      plan: {
        schemaVersion: budgetPlanSchemaVersion,
        id: "budget_incomplete",
      },
    });
    await repository.saveActivePlan(existingPlan);

    await expect(
      replaceActivePlanFromBackup({
        repository,
        backupJson: invalidBackupJson,
      }),
    ).rejects.toThrow(/valid BudgetPlan/);
    await expect(repository.loadActivePlan()).resolves.toEqual(existingPlan);
  });
});
