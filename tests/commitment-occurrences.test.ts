import { describe, expect, it } from "vitest";

import {
  generateCommitmentOccurrences,
  unpaidCommitmentDeduction,
} from "../src/domain";
import type { CommitmentTemplate, Money } from "../src/domain";

const money = (minorUnits: number): Money => minorUnits;

const commitment = (
  overrides: Partial<CommitmentTemplate> & Pick<CommitmentTemplate, "id">,
): CommitmentTemplate => ({
  id: overrides.id,
  createdAt: "2026-06-01T08:00:00.000Z",
  updatedAt: "2026-06-01T08:00:00.000Z",
  name: overrides.name ?? overrides.id,
  kind: overrides.kind ?? "bill",
  amount: overrides.amount ?? money(10_000),
  active: overrides.active ?? true,
  startsOn: overrides.startsOn ?? "2026-06-01",
  endsOn: overrides.endsOn,
  recurrence: overrides.recurrence ?? {
    frequency: "one-time",
    interval: 1,
    anchorDate: overrides.startsOn ?? "2026-06-01",
  },
  categoryId: overrides.categoryId,
});

describe("commitment occurrences", () => {
  it("generates active bill and debt occurrences with overdue, due today, and future timing", () => {
    const occurrences = generateCommitmentOccurrences({
      commitments: [
        commitment({
          id: "bill_rent",
          name: "Rent",
          kind: "bill",
          amount: money(120_000),
          startsOn: "2026-06-10",
        }),
        commitment({
          id: "debt_card",
          name: "Card",
          kind: "debt",
          amount: money(25_000),
          startsOn: "2026-06-19",
        }),
        commitment({
          id: "bill_phone",
          name: "Phone",
          kind: "bill",
          amount: money(8_000),
          startsOn: "2026-06-25",
        }),
      ],
      period: {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      today: "2026-06-19",
      financialEvents: [],
      amountOverrides: [],
    });

    expect(
      occurrences.map(({ templateId, kind, date, timing, remainingUnpaidAmount }) => ({
        templateId,
        kind,
        date,
        timing,
        remainingUnpaidAmount,
      })),
    ).toEqual([
      {
        templateId: "bill_rent",
        kind: "bill",
        date: "2026-06-10",
        timing: "overdue",
        remainingUnpaidAmount: 120_000,
      },
      {
        templateId: "debt_card",
        kind: "debt",
        date: "2026-06-19",
        timing: "due-today",
        remainingUnpaidAmount: 25_000,
      },
      {
        templateId: "bill_phone",
        kind: "bill",
        date: "2026-06-25",
        timing: "future",
        remainingUnpaidAmount: 8_000,
      },
    ]);
  });

  it("skips inactive templates and applies dated amount overrides", () => {
    const occurrences = generateCommitmentOccurrences({
      commitments: [
        commitment({
          id: "bill_inactive",
          active: false,
          amount: money(10_000),
          startsOn: "2026-06-20",
        }),
        commitment({
          id: "bill_utility",
          amount: money(9_000),
          startsOn: "2026-06-20",
        }),
      ],
      period: {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      today: "2026-06-19",
      financialEvents: [],
      amountOverrides: [
        {
          id: "override_utility_june",
          createdAt: "2026-06-19T08:00:00.000Z",
          updatedAt: "2026-06-19T08:00:00.000Z",
          commitmentTemplateId: "bill_utility",
          occurrenceDate: "2026-06-20",
          amount: money(12_500),
        },
      ],
    });

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      templateId: "bill_utility",
      date: "2026-06-20",
      amount: 12_500,
      remainingUnpaidAmount: 12_500,
    });
  });

  it("applies partial and full payments without counting paid occurrences as unpaid deductions", () => {
    const occurrences = generateCommitmentOccurrences({
      commitments: [
        commitment({
          id: "bill_power",
          amount: money(15_000),
          startsOn: "2026-06-10",
        }),
        commitment({
          id: "debt_card",
          kind: "debt",
          amount: money(20_000),
          startsOn: "2026-06-15",
        }),
      ],
      period: {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
      today: "2026-06-19",
      amountOverrides: [],
      financialEvents: [
        {
          id: "payment_power_partial",
          createdAt: "2026-06-11T08:00:00.000Z",
          updatedAt: "2026-06-11T08:00:00.000Z",
          date: "2026-06-11",
          kind: "commitment-payment",
          amount: money(5_000),
          commitmentTemplateId: "bill_power",
          occurrenceDate: "2026-06-10",
        },
        {
          id: "payment_card_full",
          createdAt: "2026-06-16T08:00:00.000Z",
          updatedAt: "2026-06-16T08:00:00.000Z",
          date: "2026-06-16",
          kind: "commitment-payment",
          amount: money(25_000),
          commitmentTemplateId: "debt_card",
          occurrenceDate: "2026-06-15",
        },
      ],
    });

    expect(
      occurrences.map(({ templateId, paidAmount, remainingUnpaidAmount, paid }) => ({
        templateId,
        paidAmount,
        remainingUnpaidAmount,
        paid,
      })),
    ).toEqual([
      {
        templateId: "bill_power",
        paidAmount: 5_000,
        remainingUnpaidAmount: 10_000,
        paid: false,
      },
      {
        templateId: "debt_card",
        paidAmount: 25_000,
        remainingUnpaidAmount: 0,
        paid: true,
      },
    ]);

    expect(unpaidCommitmentDeduction(occurrences)).toBe(10_000);
  });
});
