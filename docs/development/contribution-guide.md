# Contribution guide

This repository is meant to be understandable by new contributors without relying on hidden context. Keep changes small, documented, and aligned with the existing architecture.

## Branch workflow

Create a branch for each change set using a descriptive name:

```bash
git checkout -b feature/incident-dashboard-fix
```

Good patterns include:

- `feature/add-dispatch-plan-view`
- `fix/backend-prisma-schema`
- `docs/update-ai-readme`

## Coding expectations

- Prefer clear, minimal code changes over broad refactors.
- Update the relevant README or docs when the developer workflow changes.
- Keep API contracts and environment variables documented.
- Do not commit secrets, local `.env` files, or generated build output.

## Pull request checklist

Before opening a PR, confirm:

- relevant files are updated
- the change does not disrupt the backend or AI service contracts
- local build or validation commands pass
- new environment variables are documented
- screenshots or reproduction steps are included for UI changes

## Issue handling

When reporting an issue:

- state the expected behavior
- include the actual behavior
- share local environment details when relevant
- include reproduction steps and logs

## Documentation standards

- Use clear, factual documentation tied to the code that exists today.
- Distinguish implemented behaviors from planned features.
- Link to architecture and setup guides when the change affects deployment or integration.
