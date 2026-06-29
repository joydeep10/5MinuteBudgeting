import { budgetPlanSchemaVersion } from "../domain";
import type { BudgetPlan, ExportSnapshot, Money, Timestamp } from "../domain";

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

export interface BudgetSnapshotFileExport {
  fileName: string;
  mimeType: string;
  contents: string;
}

export interface CreateBudgetSnapshotFileExportInput {
  snapshot: ExportSnapshot;
  generatedAt: Timestamp;
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

export function createBudgetSnapshotPdfExport({
  snapshot,
  generatedAt,
}: CreateBudgetSnapshotFileExportInput): BudgetSnapshotFileExport {
  const lines = [
    "5-Minute Budgeting",
    "Budget snapshot",
    `Generated ${generatedAt}`,
    `Period ${snapshot.activePeriod.startDate} to ${snapshot.activePeriod.endDate}`,
    `Safe to spend today ${formatExportMoney(
      snapshot.metrics.confirmed.safeToday,
      snapshot,
    )}`,
    `Safe this week ${formatExportMoney(
      snapshot.metrics.confirmed.safeThisWeek,
      snapshot,
    )}`,
    `Safe this period ${formatExportMoney(
      snapshot.metrics.confirmed.safeThisPeriod,
      snapshot,
    )}`,
    `Health ${snapshot.metrics.health}`,
    `Available money ${formatExportMoney(
      snapshot.summary.effectiveAvailableMoney,
      snapshot,
    )}`,
    `Upcoming commitments ${formatExportMoney(
      snapshot.summary.unpaidCommitments,
      snapshot,
    )}`,
    `Protected savings ${formatExportMoney(
      snapshot.summary.protectedSavings,
      snapshot,
    )}`,
    `Safety buffer ${formatExportMoney(snapshot.summary.fixedBuffer, snapshot)}`,
    "Category breakdown",
    ...snapshot.report.spendingSummaries.map(
      (summary) =>
        `${summary.categoryName} spent ${formatExportMoney(
          summary.spentAmount,
          snapshot,
        )}`,
    ),
    "Commitments",
    ...snapshot.report.commitments.map(
      (commitment) =>
        `${commitment.name} due ${commitment.date} remaining ${formatExportMoney(
          commitment.remainingUnpaidAmount,
          snapshot,
        )}`,
    ),
    "Exports are snapshots. Budget data remains local to this browser.",
  ];

  return {
    fileName: snapshotFileName(snapshot, "pdf"),
    mimeType: "application/pdf",
    contents: renderSimplePdf(lines),
  };
}

export function createBudgetSnapshotWorkbookExport({
  snapshot,
  generatedAt,
}: CreateBudgetSnapshotFileExportInput): BudgetSnapshotFileExport {
  const summaryRows = [
    ["Generated at", generatedAt],
    ["As of date", snapshot.asOfDate],
    ["Period start", snapshot.activePeriod.startDate],
    ["Period end", snapshot.activePeriod.endDate],
    ["Safe to spend today", formatExportMoney(snapshot.metrics.confirmed.safeToday, snapshot)],
    ["Safe this week", formatExportMoney(snapshot.metrics.confirmed.safeThisWeek, snapshot)],
    ["Safe this period", formatExportMoney(snapshot.metrics.confirmed.safeThisPeriod, snapshot)],
    ["Health", snapshot.metrics.health],
    ["Available money", formatExportMoney(snapshot.summary.effectiveAvailableMoney, snapshot)],
    ["Upcoming commitments", formatExportMoney(snapshot.summary.unpaidCommitments, snapshot)],
    ["Protected savings", formatExportMoney(snapshot.summary.protectedSavings, snapshot)],
    ["Safety buffer", formatExportMoney(snapshot.summary.fixedBuffer, snapshot)],
    ["Snapshot note", "Exports are snapshots. Budget data remains local to this browser."],
  ];
  const ledgerRows = snapshot.report.ledgerRows.map((row) => [
    row.date,
    row.rowType,
    row.label,
    formatExportMoney(row.amount, snapshot),
    row.categoryId ?? "",
    row.relatedRecordId ?? "",
  ]);
  const commitmentRows = snapshot.report.commitments.map((commitment) => [
    commitment.date,
    commitment.name,
    commitment.kind,
    formatExportMoney(commitment.amount, snapshot),
    formatExportMoney(commitment.remainingUnpaidAmount, snapshot),
    commitment.paid ? "Paid" : "Unpaid",
  ]);
  const categoryRows = snapshot.report.spendingSummaries.map((summary) => [
    summary.categoryName,
    summary.categoryKind,
    formatExportMoney(summary.spentAmount, snapshot),
    summary.periodLimit === undefined
      ? ""
      : formatExportMoney(summary.periodLimit, snapshot),
    formatExportMoney(summary.overageAmount, snapshot),
  ]);

  return {
    fileName: snapshotFileName(snapshot, "xls"),
    mimeType: "application/vnd.ms-excel",
    contents: renderWorkbookXml([
      {
        name: "Summary",
        rows: summaryRows,
      },
      {
        name: "Ledger",
        rows: [["Date", "Type", "Label", "Amount", "Category", "Related record"], ...ledgerRows],
      },
      {
        name: "Commitments",
        rows: [["Date", "Name", "Kind", "Amount", "Remaining", "Status"], ...commitmentRows],
      },
      {
        name: "Categories",
        rows: [["Category", "Kind", "Spent", "Guidance", "Overage"], ...categoryRows],
      },
    ]),
  };
}

function cloneBudgetPlan(plan: BudgetPlan): BudgetPlan {
  return JSON.parse(JSON.stringify(plan)) as BudgetPlan;
}

function snapshotFileName(snapshot: ExportSnapshot, extension: "pdf" | "xls"): string {
  return `5-minute-budgeting-snapshot-${snapshot.asOfDate}.${extension}`;
}

function formatExportMoney(amount: Money, snapshot: ExportSnapshot): string {
  const sign = amount < 0 ? "-" : "";
  const absoluteAmount = Math.abs(amount);
  const scale = 10 ** snapshot.currency.decimalPlaces;
  const whole = Math.floor(absoluteAmount / scale);
  const fraction = String(absoluteAmount % scale).padStart(
    snapshot.currency.decimalPlaces,
    "0",
  );
  const prefix = snapshot.currency.symbol ?? `${snapshot.currency.code} `;

  return `${sign}${prefix}${whole}.${fraction}`;
}

function renderSimplePdf(lines: readonly string[]): string {
  const textCommands = lines
    .slice(0, 32)
    .map(
      (line, index) =>
        `BT /F1 ${index < 2 ? 18 : 11} Tf 56 ${760 - index * 22} Td (${escapePdfText(
          line,
        )}) Tj ET`,
    )
    .join("\n");
  const stream = `${textCommands}\n`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}endstream endobj\n`,
  ];
  let contents = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(contents.length);
    contents += object;
  }

  const xrefStart = contents.length;
  const xrefRows = offsets
    .map((offset, index) =>
      index === 0
        ? "0000000000 65535 f "
        : `${String(offset).padStart(10, "0")} 00000 n `,
    )
    .join("\n");

  return `${contents}xref
0 ${objects.length + 1}
${xrefRows}
trailer << /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefStart}
%%EOF`;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function renderWorkbookXml(
  sheets: readonly { name: string; rows: readonly (readonly string[])[] }[],
): string {
  return [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    ...sheets.map(
      (sheet) =>
        `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${sheet.rows
          .map(
            (row) =>
              `<Row>${row
                .map(
                  (cell) =>
                    `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`,
                )
                .join("")}</Row>`,
          )
          .join("")}</Table></Worksheet>`,
    ),
    "</Workbook>",
  ].join("");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
