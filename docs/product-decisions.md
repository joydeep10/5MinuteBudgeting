# Product Decisions

5-Minute Budgeting is a privacy-first, browser-local budgeting app focused on one answer: how much money is safe to spend without missing upcoming commitments, protected savings, or a personal buffer.

The MVP starts with the core product foundation before UI depth. Users should be able to build one active budget plan, enter the money available for that budget, choose a period start and end date, add required commitments, and protect a fixed buffer. Future slices will add the domain model, calculation engine, recurrence generation, warnings, simulator, exports, persistence, and UI.

Confirmed safe-to-spend must stay separate from projection. Confirmed results use only confirmed money and known deductions. Future income can appear later as projected context only when the user explicitly enables it for projection. Main health status and warnings are based on confirmed results, not optimistic assumptions.

The product should avoid account setup, bank connections, AI, and heavyweight finance workflows in the MVP. The app should feel fast, local, and understandable. It should answer first and let users improve accuracy later through check-ins, balance updates, spending logs, commitment payments, savings contributions, and period roll-forward.

Money is represented as integer minor units and one currency belongs to a budget plan. Date values are stored as date-only strings interpreted in the browser's local timezone. These decisions keep the domain deterministic and ready for tests before storage or UI concerns are added.
