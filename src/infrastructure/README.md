# Infrastructure

The infrastructure layer adapts browser and platform capabilities to the application layer.

## Belongs here

- IndexedDB persistence adapters for local BudgetPlan storage.
- Lightweight preferences storage if localStorage is needed.
- ID generation, clock adapters, import/export file handling, and notification adapters.
- Browser API wrappers used through application-layer interfaces.

## Does not belong here

- Domain business rules.
- User workflow orchestration that belongs in application.
- Shared visual components.
- Feature-specific UI state.
