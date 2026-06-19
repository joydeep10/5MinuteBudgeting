# UI

The UI layer owns reusable presentational building blocks and visual formatting.

## Belongs here

- Shared components, layout primitives, buttons, form controls, display formatting, and styling helpers.
- Components that receive data and callbacks rather than owning domain behavior.
- Visual states that can be reused across features.

## Does not belong here

- BudgetPlan mutation rules.
- Safe-to-spend calculation logic.
- Browser persistence or notification adapters.
- Route setup or app provider wiring.
