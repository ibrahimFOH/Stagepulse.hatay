# Tester

Before any proposed repair:
- JavaScript syntax
- Edge Function type checks
- migration integrity
- permission architecture checks
- production route smoke checks

After repair, repeat the same checks and compare results.

A green workflow is not proof that browser FCM registration works; browser-only diagnostics must remain explicit.
