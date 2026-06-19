# Application

The application layer coordinates user intentions against the domain model.

## Belongs here

- Use cases such as creating a plan, logging spend, updating balance, paying commitments, confirming income, recording savings, and rolling periods forward.
- Immutable BudgetPlan updates returned to callers.
- Interfaces for infrastructure services such as ID generation, clocks, or persistence.

## Does not belong here

- React rendering and component state.
- Concrete browser storage adapters.
- CSS, layout decisions, or route definitions.
- Core calculation rules that belong in domain.
