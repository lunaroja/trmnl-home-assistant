<!-- second-brain-repository-bootstrap:v1 -->

# Repository agent guide

This repository extends Abraham's canonical agent contract at
`/Users/abraham/src/second-brain/AGENTS.md`. Repository-specific instructions
below add to that contract; they do not replace it.

## Required task-start synchronization

Before substantive work or a substantive response in a new task:

1. Run `.codex/bin/repository-preflight` from anywhere inside this repository.
2. If it reports a dirty, detached, untracked, or diverged checkout, preserve
   the existing work and report the exact synchronization blocker. Never reset,
   clean, force, or overwrite work to make the preflight pass.
3. After a successful pull, read the current Second Brain `AGENTS.md`, then this
   file, before acting. Start a new task if pulled instruction changes must be
   loaded by the runtime immediately.

The preflight verifies the global Second Brain link and performs only
fast-forward pulls for clean checkouts with tracking branches.

## Repository-specific instructions

This is Abraham's authorized fork of `usetrmnl/trmnl-home-assistant` for
refresh-aware scheduling (homeassistant issue #268). Preserve upstream conventions
in CLAUDE.md. Work in `trmnl-ha/ha-trmnl`: Bun tests, lint, and typecheck are
required. Household settings and deployment evidence belong in homeassistant;
never commit account tokens, HA tokens, webhook URLs or runtime data here.
Keep this bootstrap commit separate from the reusable implementation. Upstream
issues, comments and pull requests require Abraham's later explicit approval.
