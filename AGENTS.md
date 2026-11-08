# Project guidance

- Run `mise run check` before completing changes.
- TypeSpec is the source of truth. Regenerate `backend/api/generated/`, `backend/src/generated/`, and `frontend/src/generated/`; never edit generated files by hand.
- Keep lint rules enabled. Any narrow exception needs a reason and a human decision.
- Use Conventional Commits for commit messages.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five-label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context layout. See `docs/agents/domain.md`.
