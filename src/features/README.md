# Features

Feature modules group user-facing workflows once UI slices begin.

## Belongs here

- Setup, dashboard, commitments, savings, spending log, simulator, exports, and roll-forward feature composition.
- Feature-specific state and interactions that call application use cases.
- Thin adapters between workflow screens and shared UI components.

## Does not belong here

- Pure safe-to-spend calculation behavior.
- Concrete persistence implementations.
- Global app bootstrap.
- Generic UI primitives that should live in `src/ui`.
