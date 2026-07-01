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

function schemaVersionOnePlan(
  mode: "fixed-income" | "irregular-income" | "general" = "general",
) {
  const {
    budgetingStyle,
    incomeSchedule,
    carriedForwardMoney,
    independentBufferTracker,
    ...currentPlan
  } = testPlan();
  void budgetingStyle;
  void incomeSchedule;
  void carriedForwardMoney;
  void independentBufferTracker;

  return {
    ...currentPlan,
    schemaVersion: 1 as const,
    mode,
  };
}

class InMemoryEnvelopeStore implements BudgetPlanEnvelopeStore {
  private envelope?: StoredBudgetPlanEnvelope;
  private writeAttempts = 0;

  constructor(private readonly writeFailure?: Error) {}

  async read(key: string): Promise<StoredBudgetPlanEnvelope | undefined> {
    return this.envelope?.key === key ? structuredClone(this.envelope) : undefined;
  }

  async write(envelope: StoredBudgetPlanEnvelope): Promise<void> {
    this.writeAttempts += 1;

    if (this.writeFailure !== undefined) {
      throw this.writeFailure;
    }

    this.envelope = structuredClone(envelope);
  }

  seed(envelope: StoredBudgetPlanEnvelope): void {
    this.envelope = structuredClone(envelope);
  }

  lastWritten(): StoredBudgetPlanEnvelope | undefined {
    return this.envelope;
  }

  writeCount(): number {
    return this.writeAttempts;
  }
}

describe("BudgetPlan persistence and backup", () => {
  it("persists and reloads the complete schema-v2 budgeting profile", async () => {
    const store = new InMemoryEnvelopeStore();
    const repository = createBudgetPlanRepository({
      store,
      now: () => "2026-07-01T10:00:00.000Z",
    });
    const plan = {
      ...testPlan(),
      schemaVersion: budgetPlanSchemaVersion,
      budgetingStyle: "regular-paycheck",
      incomeSchedule: {
        kind: "regular-paycheck",
        cadence: "twice-monthly",
        nextPayday: "2026-07-15",
        customPaydays: ["2026-07-15", "2026-07-31"],
      },
      carriedForwardMoney: {
        amount: money(12_500),
        sourcePeriod: {
          startDate: "2026-05-01",
          endDate: "2026-05-31",
        },
      },
      independentBufferTracker: {
        enabled: true,
        startingAmount: money(30_000),
        spendingRecords: [
          {
            id: "buffer-spending_1",
            createdAt: "2026-07-01T09:00:00.000Z",
            updatedAt: "2026-07-01T09:00:00.000Z",
            date: "2026-07-01",
            amount: money(2_500),
            category: "Coffee",
            note: "Team catch-up",
          },
        ],
      },
    } as const;

    await repository.saveActivePlan(plan);

    await expect(repository.loadActivePlan()).resolves.toEqual(plan);
  });

  it("migrates a complete schema-v1 budget without losing financial data", async () => {
    const store = new InMemoryEnvelopeStore();
    const repository = createBudgetPlanRepository({
      store,
      now: () => "2026-07-01T11:00:00.000Z",
    });
    const {
      budgetingStyle,
      incomeSchedule,
      carriedForwardMoney,
      independentBufferTracker,
      ...currentPlan
    } = testPlan();
    void budgetingStyle;
    void incomeSchedule;
    void carriedForwardMoney;
    void independentBufferTracker;
    const legacyPlan = {
      ...currentPlan,
      schemaVersion: 1,
      mode: "general",
      plannedRecords: {
        ...currentPlan.plannedRecords,
        incomeTemplates: [
          {
            id: "income_legacy",
            createdAt: "2026-05-01T08:00:00.000Z",
            updatedAt: "2026-05-01T08:00:00.000Z",
            name: "Consulting",
            amount: money(80_000),
            active: true,
            startsOn: "2026-05-10",
            recurrence: {
              frequency: "monthly",
              interval: 1,
              anchorDate: "2026-05-10",
              monthly: { dayOfMonth: 10, missingDayBehavior: "last-valid-day" },
            },
            includeInProjection: true,
          },
        ],
        commitmentTemplates: [
          {
            id: "commitment_legacy",
            createdAt: "2026-05-01T08:00:00.000Z",
            updatedAt: "2026-05-01T08:00:00.000Z",
            name: "Rent",
            kind: "bill",
            amount: money(60_000),
            active: true,
            startsOn: "2026-05-05",
            recurrence: {
              frequency: "monthly",
              interval: 1,
              anchorDate: "2026-05-05",
              monthly: { dayOfMonth: 5, missingDayBehavior: "last-valid-day" },
            },
          },
        ],
        savingsGoals: [
          {
            id: "goal_legacy",
            createdAt: "2026-05-01T08:00:00.000Z",
            updatedAt: "2026-05-01T08:00:00.000Z",
            name: "Emergency fund",
            targetAmount: money(500_000),
            currentAmount: money(120_000),
            status: "active",
            protected: true,
          },
        ],
      },
      financialEvents: [
        {
          id: "event_legacy",
          createdAt: "2026-06-02T08:00:00.000Z",
          updatedAt: "2026-06-02T08:00:00.000Z",
          date: "2026-06-02",
          kind: "spending",
          amount: money(3_500),
          categoryId: currentPlan.plannedRecords.categories[0]?.id,
          note: "Groceries",
        },
      ],
      periodSnapshots: [
        {
          id: "period_legacy",
          createdAt: "2026-05-31T18:00:00.000Z",
          updatedAt: "2026-05-31T18:00:00.000Z",
          period: { startDate: "2026-05-01", endDate: "2026-05-31" },
          startingAvailableMoney: money(130_000),
          endingEffectiveAvailableMoney: money(125_000),
          totalSpending: money(5_000),
          totalCommitmentsPaid: money(60_000),
          totalSavingsContributions: money(10_000),
          finalHealthStatus: "safe",
        },
      ],
      reminderPreferences: {
        dailyCheckInEnabled: true,
        dailyCheckInTime: "18:30",
        dueItemRemindersEnabled: true,
        browserNotificationsEnabled: false,
      },
    } as const;
    store.seed({
      key: activeBudgetPlanStorageKey,
      schemaVersion: 1,
      savedAt: "2026-06-30T20:00:00.000Z",
      plan: legacyPlan,
    } as unknown as StoredBudgetPlanEnvelope);
    const { mode, ...preservedLegacyPlan } = legacyPlan;
    void mode;
    const expectedPlan = {
      ...preservedLegacyPlan,
      schemaVersion: budgetPlanSchemaVersion,
      budgetingStyle: "general-budget",
      incomeSchedule: { kind: "unconfigured" },
      carriedForwardMoney: { amount: money(0) },
      independentBufferTracker: {
        enabled: false,
        startingAmount: money(0),
        spendingRecords: [],
      },
    };

    await expect(repository.loadActivePlan()).resolves.toEqual(expectedPlan);
    expect(store.lastWritten()).toEqual({
      key: activeBudgetPlanStorageKey,
      schemaVersion: budgetPlanSchemaVersion,
      savedAt: "2026-07-01T11:00:00.000Z",
      plan: expectedPlan,
    });
  });

  it.each([
    ["fixed-income", "regular-paycheck"],
    ["irregular-income", "irregular-income"],
  ] as const)(
    "maps legacy %s budgets to the %s budgeting style",
    async (legacyMode, expectedStyle) => {
      const store = new InMemoryEnvelopeStore();
      const repository = createBudgetPlanRepository({
        store,
        now: () => "2026-07-01T11:15:00.000Z",
      });
      store.seed({
        key: activeBudgetPlanStorageKey,
        schemaVersion: 1,
        savedAt: "2026-06-30T20:00:00.000Z",
        plan: schemaVersionOnePlan(legacyMode),
      } as unknown as StoredBudgetPlanEnvelope);

      await expect(repository.loadActivePlan()).resolves.toMatchObject({
        budgetingStyle: expectedStyle,
        incomeSchedule: { kind: "unconfigured" },
      });
    },
  );

  it("leaves malformed schema-v1 data untouched when migration fails", async () => {
    const store = new InMemoryEnvelopeStore();
    const repository = createBudgetPlanRepository({
      store,
      now: () => "2026-07-01T11:30:00.000Z",
    });
    const invalidLegacyEnvelope = {
      key: activeBudgetPlanStorageKey,
      schemaVersion: 1,
      savedAt: "2026-06-30T20:00:00.000Z",
      plan: {
        schemaVersion: 1,
        id: "budget_incomplete",
        mode: "general",
      },
    } as unknown as StoredBudgetPlanEnvelope;
    store.seed(invalidLegacyEnvelope);

    await expect(repository.loadActivePlan()).rejects.toMatchObject({
      name: "BudgetPlanMigrationError",
    });
    expect(store.writeCount()).toBe(0);
    expect(store.lastWritten()).toEqual(invalidLegacyEnvelope);
  });

  it("preserves schema-v1 data when writing the migration fails", async () => {
    const store = new InMemoryEnvelopeStore(new Error("Storage quota exceeded."));
    const repository = createBudgetPlanRepository({
      store,
      now: () => "2026-07-01T11:45:00.000Z",
    });
    const legacyEnvelope = {
      key: activeBudgetPlanStorageKey,
      schemaVersion: 1,
      savedAt: "2026-06-30T20:00:00.000Z",
      plan: schemaVersionOnePlan(),
    } as unknown as StoredBudgetPlanEnvelope;
    store.seed(legacyEnvelope);

    await expect(repository.loadActivePlan()).rejects.toMatchObject({
      name: "BudgetPlanMigrationError",
      cause: expect.objectContaining({ message: "Storage quota exceeded." }),
    });
    expect(store.writeCount()).toBe(1);
    expect(store.lastWritten()).toEqual(legacyEnvelope);
  });

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
