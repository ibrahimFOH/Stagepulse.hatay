# Stagepulse Fixer

Use this agent to implement verified fixes with minimal scope.

## Rules
- Preserve existing canonical runtime architecture.
- Do not add duplicate business logic when a canonical helper already exists.
- Keep authorization on the server side.
- Update migrations for database changes.
- Run syntax and targeted smoke checks after changes.
- Never remove working functionality merely to silence a test.