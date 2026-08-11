# AGENTS.md

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues on `AimalShah/Store-POS`, driven through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five triage labels are used: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: one `CONTEXT.md` at the root plus `docs/adr/` for decisions. See `docs/agents/domain.md`.

## UI

This project uses **shadcn/ui exclusively** for all UI, installed only via the official CLI. See `.opencode/skills/design/SKILL.md` before writing any UI code.
