import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const guard = join(import.meta.dirname, "guard-screen-agent.mjs");
const root = process.cwd();
const launcher = ".claude/skills/impeccable/scripts/impeccable";

// Exit code 2 blocks the tool call; 0 lets it through.
function run(cwd: string, tool_name: string, tool_input: Record<string, string>) {
  return spawnSync(process.execPath, [guard], { input: JSON.stringify({ tool_name, tool_input, cwd }), encoding: "utf8" })
    .status;
}

const blocked: [string, Record<string, string>][] = [
  ["Bash", { command: "npm install lodash" }],
  ["Bash", { command: "npx --yes shadcn@4 add table" }],
  ["Bash", { command: "git push origin main" }],
  ["Bash", { command: "npx impeccable install --providers=claude" }],
  ["Bash", { command: `${launcher} hooks ignore-value gradient-text "*" --file x.tsx` }],
  ["Bash", { command: `"D:/repo/${launcher}" hooks off` }],
  ["Bash", { command: `${launcher} update` }],
  ["Bash", { command: `${launcher} pin pin audit` }],
  ["PowerShell", { command: String.raw`& .\.claude\skills\impeccable\scripts\impeccable.cmd ignores add-rule side-tab` }],
  ["Write", { file_path: ".impeccable/config.json" }],
  ["Write", { file_path: "PRODUCT.md" }],
  ["Edit", { file_path: ".claude/skills/impeccable/SKILL.md" }],
  ["Edit", { file_path: "src/components/shared/status-pill.tsx" }],
];

const allowed: [string, Record<string, string>][] = [
  ["Bash", { command: `${launcher} detect src/features/dashboard` }],
  ["Bash", { command: `${launcher} detect http://localhost:3001/` }],
  ["Bash", { command: `${launcher} hooks status` }],
  ["Bash", { command: "npm run typecheck" }],
  ["Write", { file_path: "src/features/dashboard/data/fixtures.ts" }],
  ["Write", { file_path: "e2e/w1-dashboard.spec.ts" }],
];

describe("guard-screen-agent", () => {
  for (const cwd of [root, join(root, ".claude/worktrees/agent-x")]) {
    it.each(blocked)(`blocks %s %j (cwd ${cwd === root ? "main" : "worktree"})`, (tool, input) => {
      expect(run(cwd, tool, input)).toBe(2);
    });
    it.each(allowed)(`allows %s %j (cwd ${cwd === root ? "main" : "worktree"})`, (tool, input) => {
      expect(run(cwd, tool, input)).toBe(0);
    });
  }

  it("blocks a write from a worktree into the main checkout", () => {
    expect(run(join(root, ".claude/worktrees/agent-x"), "Write", { file_path: join(root, "src/features/x.ts") })).toBe(2);
  });
});
