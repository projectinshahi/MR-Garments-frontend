// PreToolUse guard for screen agents (wired in .claude/agents/screen-builder.md).
// Blocks dependency changes, pushes, and edits to orchestrator-owned shared files.
// Exit code 2 blocks the tool call and shows stderr to the agent.
import { isAbsolute, relative, resolve } from "node:path";

const SHARED_FILES = [
  /^package(-lock)?\.json$/,
  /^(next|vitest|playwright|eslint)\.config\.\w+$/,
  /^(tsconfig\.json|components\.json|vitest\.setup\.ts|CLAUDE\.md|AGENTS\.md|README\.md)$/,
  /^src\/app\/(layout\.tsx|globals\.css)$/,
  // Route-group layouts and boundaries: (app), (staff), (auth).
  /^src\/app\/\([^/]+\)\/(layout|loading|error|not-found)\.tsx$/,
  /^src\/app\/\(app\)\/preview\//,
  // Order-detail frame shared by W1-order-detail-a and W1-order-detail-b.
  /^src\/app\/\(app\)\/orders\/\[po\]\/layout\.tsx$/,
  /^src\/features\/order-detail\/shared\//,
  /^src\/(components|config|hooks|lib|mocks|types)\//,
  /^e2e\/shell\.spec\.ts$/,
  /^(\.claude|\.impeccable|docs)\//,
  /^(PRODUCT|DESIGN)\.md$/,
];

const SHARED_COMMANDS =
  /\b(npm|pnpm|yarn|bun)\s+(i|install|add|ci|uninstall|remove|rm|un|update|upgrade|up|dedupe|link)\b|\bnpx\s+(-y\s+|--yes\s+)?(shadcn\b|impeccable\s+(install|update|link|ignores|hooks)\b)|\bgit\s+push\b/;

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const { tool_name: tool, tool_input: input = {}, cwd = process.cwd() } = JSON.parse(raw);

function block(reason) {
  process.stderr.write(`Blocked for screen agents: ${reason}. Report the need to the orchestrator instead.\n`);
  process.exit(2);
}

if (tool === "Bash" || tool === "PowerShell") {
  if (SHARED_COMMANDS.test(input.command ?? ""))
    block("installing packages, the shadcn CLI, Impeccable setup commands and git push are orchestrator-only");
} else {
  const target = input.file_path ?? input.notebook_path;
  if (target) {
    // Strip a worktree prefix in case the hook runs from the main checkout.
    const rel = relative(cwd, resolve(cwd, target))
      .replaceAll("\\", "/")
      .replace(/^\.claude\/worktrees\/[^/]+\//, "");
    if (rel.startsWith("..") || isAbsolute(rel)) block(`${target} is outside your working tree`);
    if (SHARED_FILES.some((pattern) => pattern.test(rel))) block(`${rel} is a shared, orchestrator-owned file`);
  }
}
