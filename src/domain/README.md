# Domain

The domain layer owns the safe-to-spend business model and pure rules.

## Belongs here

- BudgetPlan types and value objects.
- Money, date-only, recurrence, commitment, savings, warning, simulator, and export snapshot rules.
- Pure functions that can be tested without React, browser APIs, storage, routing, or CSS.

## Does not belong here

- React components or hooks.
- IndexedDB, localStorage, fetch, notifications, or browser-specific APIs.
- Routing, styling, Vite configuration, or UI copy.

The domain layer must not depend on React, storage, browser APIs, routing, or CSS.
