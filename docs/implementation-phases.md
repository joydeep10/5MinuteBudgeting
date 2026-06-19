# Implementation Phases

Phase 1 proves the core engine before building the full interface. It starts with this foundation: React, Vite, TypeScript, npm, Vitest, date-fns, documentation, and source boundaries.

The next slices should define the BudgetPlan model, recurrence primitives, effective available money rules, commitment occurrence and payment behavior, savings allocation, safe-to-spend calculation, health status, structured warning generation, simulator behavior, export-ready snapshots, and roll-forward support. Domain tests should lead this work through public APIs and business outcomes.

Application use cases should follow once the domain behavior is stable. They should verify immutable updates for creating a budget, recording a balance snapshot, logging spending, marking a commitment paid, confirming income received, recording a savings contribution, and rolling a period forward.

UI work comes after the trusted calculation brain exists. The eventual interface should include setup, dashboard, quick spend logging, bill calendar, savings goals, warnings, simulator, downloads, and privacy messaging. This foundation issue does not implement feature UI, storage, or calculator logic.

Persistence is a later slice. IndexedDB should store budget data when implemented, while localStorage should be limited to lightweight preferences. JSON backup and import should be explicit and validated enough to avoid replacing local data with obviously invalid payloads.
