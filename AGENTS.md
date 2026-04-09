# Agent workflow (short)

1. **Intent bridge** — Before plan or code: [`.cursor/rules/intent-first-partner.mdc`](.cursor/rules/intent-first-partner.mdc) (always on). Restate the user’s goal in plain language; treat casual instructions as **direction and outcome** unless they explicitly prescribe files/APIs/constraints. Optional deep pass: [`.cursor/skills/intent-first-partner/SKILL.md`](.cursor/skills/intent-first-partner/SKILL.md).
2. **Plan** — e.g. `feature-planner-tech-lead` or user-provided spec.
3. **Harden plan** — Chat slash: **`/plan-second-pass-audit`** (loads [`.cursor/commands/plan-second-pass-audit.md`](.cursor/commands/plan-second-pass-audit.md)). Or skill: [`.cursor/skills/plan-second-pass-audit/SKILL.md`](.cursor/skills/plan-second-pass-audit/SKILL.md). Run before implementation; include primary task, constraints, and the plan.
4. **Implement** — approved revised plan only.
5. **Verify code** — `verifier-regression-guard` Cursor skill (post-implementation code review) after substantive changes.
6. **Ship** — When the task changes the repo and should land on GitHub: run `npx tsc -p tsconfig.app.json --noEmit`; if schema/migrations touched, apply per `.cursor/rules/supabase-apply-migrations.mdc`; then `git add` / `commit` / `push` the current branch. Full session rule: `.cursor/rules/post-implement-git-push.mdc`.

Typecheck before commit: `npx tsc -p tsconfig.app.json --noEmit` (see `.cursor/rules/ts-build-check.mdc`).
