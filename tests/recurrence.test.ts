import { describe, expect, it } from "vitest";

import {
  generateRecurrenceOccurrences,
  inclusiveDaysRemaining,
  parseDateOnly,
} from "../src/domain";

describe("date-only helpers", () => {
  it("interprets date-only values as local calendar dates and counts inclusive days with a minimum of one", () => {
    const parsed = parseDateOnly("2026-06-19");

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(19);
    expect(parsed.getHours()).toBe(0);

    expect(inclusiveDaysRemaining("2026-06-19", "2026-06-19")).toBe(1);
    expect(inclusiveDaysRemaining("2026-06-19", "2026-06-21")).toBe(3);
    expect(inclusiveDaysRemaining("2026-06-22", "2026-06-21")).toBe(1);
  });
});

describe("recurrence generation", () => {
  it("generates a deterministic one-time occurrence inside the requested period", () => {
    const occurrences = generateRecurrenceOccurrences({
      templateId: "commitment_rent",
      startsOn: "2026-07-01",
      recurrence: {
        frequency: "one-time",
        interval: 1,
        anchorDate: "2026-07-01",
      },
      period: {
        startDate: "2026-06-19",
        endDate: "2026-07-18",
      },
    });

    expect(occurrences).toEqual([
      {
        id: "commitment_rent:2026-07-01",
        templateId: "commitment_rent",
        date: "2026-07-01",
      },
    ]);

    expect(
      generateRecurrenceOccurrences({
        templateId: "commitment_rent",
        startsOn: "2026-07-01",
        recurrence: {
          frequency: "one-time",
          interval: 1,
          anchorDate: "2026-07-01",
        },
        period: {
          startDate: "2026-07-02",
          endDate: "2026-07-18",
        },
      }),
    ).toEqual([]);
  });

  it("generates weekly occurrences using the start weekday or an explicit weekday", () => {
    expect(
      generateRecurrenceOccurrences({
        templateId: "income_salary",
        startsOn: "2026-06-19",
        recurrence: {
          frequency: "weekly",
          interval: 1,
          anchorDate: "2026-06-19",
        },
        period: {
          startDate: "2026-06-19",
          endDate: "2026-07-10",
        },
      }).map((occurrence) => occurrence.date),
    ).toEqual(["2026-06-19", "2026-06-26", "2026-07-03", "2026-07-10"]);

    expect(
      generateRecurrenceOccurrences({
        templateId: "income_salary",
        startsOn: "2026-06-19",
        recurrence: {
          frequency: "weekly",
          interval: 1,
          anchorDate: "2026-06-19",
          weekly: {
            daysOfWeek: [1],
          },
        },
        period: {
          startDate: "2026-06-19",
          endDate: "2026-07-10",
        },
      }).map((occurrence) => occurrence.date),
    ).toEqual(["2026-06-22", "2026-06-29", "2026-07-06"]);
  });

  it("generates biweekly occurrences anchored to the start date", () => {
    const occurrences = generateRecurrenceOccurrences({
      templateId: "income_salary",
      startsOn: "2026-06-19",
      recurrence: {
        frequency: "biweekly",
        interval: 1,
        anchorDate: "2026-06-19",
      },
      period: {
        startDate: "2026-06-26",
        endDate: "2026-07-31",
      },
    });

    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      "2026-07-03",
      "2026-07-17",
      "2026-07-31",
    ]);
  });

  it("moves missing monthly dates to the last valid day and honors template end dates", () => {
    const occurrences = generateRecurrenceOccurrences({
      templateId: "commitment_card",
      startsOn: "2026-01-31",
      endsOn: "2026-03-31",
      recurrence: {
        frequency: "monthly",
        interval: 1,
        anchorDate: "2026-01-31",
        monthly: {
          dayOfMonth: 31,
          missingDayBehavior: "last-valid-day",
        },
      },
      period: {
        startDate: "2026-01-01",
        endDate: "2026-04-30",
      },
    });

    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("moves missing yearly leap-day dates to the last valid day of February", () => {
    const occurrences = generateRecurrenceOccurrences({
      templateId: "commitment_annual",
      startsOn: "2024-02-29",
      recurrence: {
        frequency: "yearly",
        interval: 1,
        anchorDate: "2024-02-29",
        yearly: {
          month: 2,
          dayOfMonth: 29,
          missingDayBehavior: "last-valid-day",
        },
      },
      period: {
        startDate: "2024-01-01",
        endDate: "2028-12-31",
      },
    });

    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });
});
