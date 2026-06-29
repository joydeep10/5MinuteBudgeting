import { budgetPlanSchemaVersion } from "../domain";
import type { BudgetPlan, Timestamp } from "../domain";

export const activeBudgetPlanStorageKey = "active-budget-plan" as const;
const budgetPlanDatabaseName = "5-minute-budgeting" as const;
const budgetPlanObjectStoreName = "budget-plan-envelopes" as const;
const budgetPlanDatabaseVersion = 1;

export interface StoredBudgetPlanEnvelope {
  key: typeof activeBudgetPlanStorageKey;
  schemaVersion: number;
  savedAt: Timestamp;
  plan: BudgetPlan;
}

export interface BudgetPlanEnvelopeStore {
  read: (key: string) => Promise<StoredBudgetPlanEnvelope | undefined>;
  write: (envelope: StoredBudgetPlanEnvelope) => Promise<void>;
}

export interface BudgetPlanRepository {
  saveActivePlan: (plan: BudgetPlan) => Promise<void>;
  loadActivePlan: () => Promise<BudgetPlan | undefined>;
}

export type NotificationPermissionStatus =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

export interface BrowserNotificationAdapter {
  permissionStatus: () => NotificationPermissionStatus;
  requestPermission: () => Promise<NotificationPermissionStatus>;
}

export interface BudgetPlanBackupEnvelope {
  schemaVersion: number;
  exportedAt: Timestamp;
  plan: BudgetPlan;
}

export interface CreateBudgetPlanRepositoryInput {
  store: BudgetPlanEnvelopeStore;
  now: () => Timestamp;
}

export interface CreateIndexedDbBudgetPlanRepositoryInput {
  databaseName?: string;
  indexedDB?: IDBFactory;
  now: () => Timestamp;
}

export interface ExportBudgetPlanBackupInput {
  plan: BudgetPlan;
  exportedAt: Timestamp;
}

export interface ReplaceActivePlanFromBackupInput {
  repository: BudgetPlanRepository;
  backupJson: string;
}

export function createBudgetPlanRepository({
  store,
  now,
}: CreateBudgetPlanRepositoryInput): BudgetPlanRepository {
  return {
    async saveActivePlan(plan) {
      await store.write({
        key: activeBudgetPlanStorageKey,
        schemaVersion: budgetPlanSchemaVersion,
        savedAt: now(),
        plan: cloneBudgetPlan(plan),
      });
    },
    async loadActivePlan() {
      const envelope = await store.read(activeBudgetPlanStorageKey);

      if (envelope === undefined) {
        return undefined;
      }

      assertSupportedStoredEnvelope(envelope);

      return cloneBudgetPlan(envelope.plan);
    },
  };
}

export function createIndexedDbBudgetPlanRepository({
  databaseName = budgetPlanDatabaseName,
  indexedDB = globalThis.indexedDB,
  now,
}: CreateIndexedDbBudgetPlanRepositoryInput): BudgetPlanRepository {
  return createBudgetPlanRepository({
    store: new IndexedDbBudgetPlanEnvelopeStore(indexedDB, databaseName),
    now,
  });
}

export function createBrowserNotificationAdapter(): BrowserNotificationAdapter {
  return {
    permissionStatus() {
      if (!("Notification" in globalThis)) {
        return "unsupported";
      }

      return normalizeNotificationPermission(globalThis.Notification.permission);
    },
    async requestPermission() {
      if (!("Notification" in globalThis)) {
        return "unsupported";
      }

      return normalizeNotificationPermission(
        await globalThis.Notification.requestPermission(),
      );
    },
  };
}

export function exportBudgetPlanBackup({
  plan,
  exportedAt,
}: ExportBudgetPlanBackupInput): string {
  const backup: BudgetPlanBackupEnvelope = {
    schemaVersion: budgetPlanSchemaVersion,
    exportedAt,
    plan: cloneBudgetPlan(plan),
  };

  return JSON.stringify(backup, null, 2);
}

export function importBudgetPlanBackup(backupJson: string): BudgetPlan {
  const backup = parseBudgetPlanBackup(backupJson);

  return cloneBudgetPlan(backup.plan);
}

export async function replaceActivePlanFromBackup({
  repository,
  backupJson,
}: ReplaceActivePlanFromBackupInput): Promise<BudgetPlan> {
  const importedPlan = importBudgetPlanBackup(backupJson);

  await repository.saveActivePlan(importedPlan);

  return importedPlan;
}

function cloneBudgetPlan(plan: BudgetPlan): BudgetPlan {
  return JSON.parse(JSON.stringify(plan)) as BudgetPlan;
}

function normalizeNotificationPermission(
  permission: NotificationPermission,
): NotificationPermissionStatus {
  if (
    permission === "granted" ||
    permission === "denied" ||
    permission === "default"
  ) {
    return permission;
  }

  return "unsupported";
}

class IndexedDbBudgetPlanEnvelopeStore implements BudgetPlanEnvelopeStore {
  private databasePromise?: Promise<IDBDatabase>;

  constructor(
    private readonly indexedDB: IDBFactory,
    private readonly databaseName: string,
  ) {}

  async read(key: string): Promise<StoredBudgetPlanEnvelope | undefined> {
    const database = await this.openDatabase();
    const transaction = database.transaction(budgetPlanObjectStoreName, "readonly");
    const store = transaction.objectStore(budgetPlanObjectStoreName);
    const envelope = await requestResult<StoredBudgetPlanEnvelope | undefined>(
      store.get(key),
    );

    await transactionComplete(transaction);

    return envelope === undefined ? undefined : cloneEnvelope(envelope);
  }

  async write(envelope: StoredBudgetPlanEnvelope): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(budgetPlanObjectStoreName, "readwrite");
    const store = transaction.objectStore(budgetPlanObjectStoreName);

    await requestResult(store.put(cloneEnvelope(envelope)));
    await transactionComplete(transaction);
  }

  private openDatabase(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = this.indexedDB.open(
        this.databaseName,
        budgetPlanDatabaseVersion,
      );

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(budgetPlanObjectStoreName)) {
          database.createObjectStore(budgetPlanObjectStoreName, {
            keyPath: "key",
          });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
      request.onblocked = () => reject(new Error("IndexedDB open was blocked."));
    });

    return this.databasePromise;
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

function cloneEnvelope(envelope: StoredBudgetPlanEnvelope): StoredBudgetPlanEnvelope {
  return {
    ...envelope,
    plan: cloneBudgetPlan(envelope.plan),
  };
}

function assertSupportedStoredEnvelope(envelope: StoredBudgetPlanEnvelope): void {
  if (envelope.schemaVersion !== budgetPlanSchemaVersion) {
    throw new Error("Stored BudgetPlan schema version is not supported.");
  }

  if (!isBudgetPlan(envelope.plan)) {
    throw new Error("Stored data must contain a valid BudgetPlan.");
  }
}

function parseBudgetPlanBackup(backupJson: string): BudgetPlanBackupEnvelope {
  let parsed: unknown;

  try {
    parsed = JSON.parse(backupJson) as unknown;
  } catch {
    throw new Error("Backup JSON must be parseable.");
  }

  if (!isRecord(parsed)) {
    throw new Error("Backup must be an object.");
  }

  if (parsed.schemaVersion !== budgetPlanSchemaVersion) {
    throw new Error("Backup schema version is not supported.");
  }

  if (typeof parsed.exportedAt !== "string") {
    throw new Error("Backup must include an exported timestamp.");
  }

  if (!isBudgetPlan(parsed.plan)) {
    throw new Error("Backup must contain a valid BudgetPlan.");
  }

  return {
    schemaVersion: parsed.schemaVersion,
    exportedAt: parsed.exportedAt,
    plan: parsed.plan,
  };
}

function isBudgetPlan(value: unknown): value is BudgetPlan {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === budgetPlanSchemaVersion &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    isBudgetMode(value.mode) &&
    isCurrency(value.currency) &&
    isActivePeriod(value.activePeriod) &&
    typeof value.fixedBuffer === "number" &&
    isPlannedRecords(value.plannedRecords) &&
    Array.isArray(value.balanceSnapshots) &&
    Array.isArray(value.financialEvents) &&
    (value.periodSnapshots === undefined || Array.isArray(value.periodSnapshots)) &&
    (value.reminderPreferences === undefined ||
      isReminderPreferences(value.reminderPreferences))
  );
}

function isBudgetMode(value: unknown): boolean {
  return (
    value === "fixed-income" ||
    value === "irregular-income" ||
    value === "general"
  );
}

function isCurrency(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.decimalPlaces === "number" &&
    (value.symbol === undefined || typeof value.symbol === "string")
  );
}

function isActivePeriod(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.startDate === "string" &&
    typeof value.endDate === "string"
  );
}

function isPlannedRecords(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.categories) &&
    Array.isArray(value.incomeTemplates) &&
    Array.isArray(value.commitmentTemplates) &&
    Array.isArray(value.savingsGoals) &&
    Array.isArray(value.flexibleCategoryGuidance)
  );
}

function isReminderPreferences(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.dailyCheckInEnabled === "boolean" &&
    typeof value.dailyCheckInTime === "string" &&
    typeof value.dueItemRemindersEnabled === "boolean" &&
    typeof value.browserNotificationsEnabled === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
