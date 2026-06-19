# Calculation Rules

The calculation engine will be implemented in later slices. This document records the intended rules so the foundation has a stable target without adding calculator logic in this issue.

Confirmed safe-to-spend is based on confirmed available money only. It subtracts required unpaid commitments in the active period, protected active savings deductions, the fixed buffer, and spending effects that have not already been absorbed by a later balance snapshot. Future unconfirmed income must never increase the confirmed safe-to-spend result.

Projected safe-to-spend is separate context. It may include active income templates that are explicitly marked for projection, but projected output must not replace or soften confirmed health and warnings.

Daily safe-to-spend uses inclusive days remaining in the active period with a minimum of one day. Shortfalls should show zero spendable money and a critical warning rather than presenting a negative allowance as something a user can spend.

Recurring commitments and income templates will share recurrence primitives. The MVP frequencies are one-time, weekly, biweekly, monthly, and yearly. Monthly and yearly recurrence should move missing calendar days to the last valid day of the month. Biweekly recurrence is anchored to the template start date.

Health status is based on confirmed results. A negative raw safe pool is Overspending. A non-negative safe pool below five percent is Risky, five percent to under thirty percent is Tight, and thirty percent or above is Safe. Buffer compromise forces health to at least Risky.
