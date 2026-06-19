# Architecture Boundaries

The app is structured as a single React and Vite project with explicit internal boundaries. The dependency direction is UI and features to application, application to domain, and domain to no outer layer.

`src/domain` owns budget concepts, value types, pure calculation rules, recurrence behavior, warnings, simulator contracts, and export snapshot builders as they are added. The domain layer must not import React, browser storage, routing, CSS, Vite APIs, or other infrastructure concerns.

`src/application` owns use cases that coordinate domain operations and return immutable updated budget plans. This layer may generate commands for persistence or UI state, but it should keep domain behavior reusable and testable.

`src/infrastructure` owns adapters for browser APIs, future IndexedDB persistence, import/export file handling, ID generation, and clock access. It adapts the outside world to the application layer.

`src/features` groups user-facing workflows when they arrive, such as setup, dashboard check-ins, savings, commitments, simulator, and exports. Feature modules can compose application use cases and UI components, but should not place business rules in components.

`src/ui` owns shared presentational components, layout primitives, formatting helpers, and visual styling. `src/app` owns app bootstrap, providers, routes, and top-level composition. These boundaries allow the product to remain domain-first while still being app-ready.
