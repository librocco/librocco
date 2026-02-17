# CI LLM Guide (Playwright Auto-fix)

This guide is for the Claude Code automation in the `Fix Playwright Failures` workflow.
Read this file before investigating failures. Then consult `AGENTS.md` for command references.

## Operating Constraints

- Job timeout: 120 minutes.
- Claude max turns: 40.
- You are responsible for PR creation and CI monitoring.
- You may run `git` commands to create a branch, commit, and push.

## Triage & Logs

Prefer `/tmp/failure-summary.txt` if present.

Otherwise, run:

```bash
gh run view <run-id> --repo "$GITHUB_REPOSITORY" --json jobs --jq '[.jobs[] | select(.conclusion == "failure") | {name, id: .databaseId}]'
gh run view <run-id> --repo "$GITHUB_REPOSITORY" --log-failed --job <job-id> 2>&1 | grep -nE '✘|Error:|FAIL|Timeout' | head -50
```

## Reproduce Locally (Preferred)

Local reproduction inside the CI job is expected. Keep it focused to stay within the time budget.

The workflow sets up the full environment before Claude runs:
- Node 22, rush on PATH, packages installed and built
- App built (`rushx build:e2e`) and restructured for `/preview` base path
- Playwright browsers installed
- Headless launcher running (sync server + Caddy serving the app)
- Services verified ready (sync server at `http://127.0.0.1:3000/`, app at `https://localhost:8433/preview/`)

You should NOT need to install deps or start services. Just run tests directly:

```bash
cd apps/e2e && npx playwright test integration/<failing>.spec.ts --project=chromium
```

If needed, run a single shard:

```bash
cd apps/e2e && rushx test:ci --shard=1/6
```

If you need to rebuild after making app changes (not just test changes):

```bash
cd apps/web-client && rushx build:e2e
cd apps/web-client && rm -rf build/preview && mkdir build/preview && mv build/!(preview) build/preview/ 2>/dev/null; true
```

If reproduction is blocked by infra or time budget, explicitly state what failed and what you tried.

## PR Creation & Monitoring

Create a branch, commit, push, open a PR, and monitor checks until green or time runs out.

```bash
git config user.name "claude-code"
git config user.email "claude-code@users.noreply.github.com"

BRANCH="auto-fix/playwright-${FAILED_RUN_ID:-manual}"
git checkout -b "$BRANCH"

git status -sb
git add -A
git commit -m "fix: playwright e2e test failures (automated)"
git push origin "$BRANCH"

gh pr create \
  --title "fix: playwright e2e test failures (automated)" \
  --body "Automated fix by Claude Code.\n\nTriggered by failed run: https://github.com/${GITHUB_REPOSITORY}/actions/runs/${FAILED_RUN_ID}" \
  --label automated,e2e \
  --base main \
  --head "$BRANCH"
```

Monitor checks (poll every 60s). Stop if time budget is low:

```bash
PR_NUMBER=$(gh pr view --json number --jq .number)

while true; do
  gh pr view "$PR_NUMBER" --json statusCheckRollup \
    --jq '.statusCheckRollup[] | {name, status, conclusion}'
  ALL_DONE=$(gh pr view "$PR_NUMBER" --json statusCheckRollup \
    --jq '[.statusCheckRollup[] | select(.status != "COMPLETED")] | length')
  FAILURES=$(gh pr view "$PR_NUMBER" --json statusCheckRollup \
    --jq '[.statusCheckRollup[] | select(.conclusion == "FAILURE" or .conclusion == "CANCELLED" or .conclusion == "TIMED_OUT")] | length')
  [ "$ALL_DONE" -eq 0 ] && [ "$FAILURES" -eq 0 ] && break
  [ "$FAILURES" -gt 0 ] && break
  sleep 60
done
```

If checks fail and there is enough time, iterate: fix, commit, push to the same branch, and re-monitor.

## Fix Scope

- Prefer fixes in `apps/e2e/` unless there is a clear app bug.
- Replace hardcoded `waitForTimeout` with explicit waits.
- Avoid flaky selectors and missing `await`s.

## Stop Conditions

- If no confident fix is possible, make no changes and report findings.
