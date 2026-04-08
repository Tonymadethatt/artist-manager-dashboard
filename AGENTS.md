# Agent workflow (short)

1. **Plan** — e.g. `feature-planner-tech-lead` or user-provided spec.
2. **Harden plan** — Chat slash: **`/plan-second-pass-audit`** (loads [`.cursor/commands/plan-second-pass-audit.md`](.cursor/commands/plan-second-pass-audit.md)). Or skill: [`.cursor/skills/plan-second-pass-audit/SKILL.md`](.cursor/skills/plan-second-pass-audit/SKILL.md). Run before implementation; include primary task, constraints, and the plan.
3. **Implement** — approved revised plan only.
4. **Verify code** — `verifier-regression-guard` Cursor skill (post-implementation code review) after substantive changes.
5. **Ship** — When the task changes the repo and should land on GitHub: run `npx tsc -p tsconfig.app.json --noEmit`; if schema/migrations touched, apply per `.cursor/rules/supabase-apply-migrations.mdc`; then `git add` / `commit` / `push` the current branch. Full session rule: `.cursor/rules/post-implement-git-push.mdc`.

Typecheck before commit: `npx tsc -p tsconfig.app.json --noEmit` (see `.cursor/rules/ts-build-check.mdc`).
