// PreToolUse guard for the Batch 1 agents (wired in .claude/agents/batch1-*.md as `guard-batch1.mjs <agent>`).
// Builders (a1-a5) may edit only the files they own, inside their own frontend and backend worktrees. QA edits nothing.
// Everyone is blocked from installs, pushes, branch and worktree changes, raw database commands and reading .env files.
// Exit code 2 blocks the tool call and shows stderr to the agent. Ownership follows the allocation the user confirmed
// (F1); change it here, never in an agent's prompt.
import { posix } from "node:path";

const FE = "d:/sdec/mr garments/mr-garments-frontend/.claude/worktrees/";
const BE = "d:/sdec/mr garments/mr-garments-backend-wt/";

// Paths are relative to the worktree root. `*` stays inside one folder, `**` crosses folders.
const AGENTS = {
  a1: {
    fe: "batch1-a1-auth",
    be: "a1-auth",
    feOwns: ["src/features/auth/login-*", "src/app/(auth)/login/**", "e2e/w3-auth.spec.ts", "e2e/batch1-a1-*.spec.ts"],
    beOwns: ["src/modules/auth/login.*"],
  },
  a2: {
    fe: "batch1-a2-users",
    be: "a2-users",
    feOwns: ["src/features/users/**", "src/app/(app)/users/**", "e2e/w3-users.spec.ts", "e2e/batch1-a2-*.spec.ts"],
    beOwns: ["src/modules/users/**"],
  },
  a3: {
    fe: null,
    be: "a3-readonly",
    feOwns: [],
    beOwns: ["src/modules/master-data/readonly.*"],
  },
  a4: {
    fe: "batch1-a4-settings",
    be: "a4-settings",
    feOwns: ["src/features/settings/**", "src/app/(app)/settings/**", "e2e/w3-settings.spec.ts", "e2e/batch1-a4-*.spec.ts"],
    beOwns: ["src/modules/master-data/suppliers.*"],
  },
  a5: {
    fe: "batch1-a5-passwords",
    be: "a5-passwords",
    feOwns: [
      "src/features/auth/change-password-*",
      "src/features/auth/set-password-*",
      "src/features/auth/password-strength*",
      "src/features/auth/data/**",
      "src/app/(auth)/change-password/**",
      "src/app/(auth)/set-password/**",
      "e2e/w3-change-password.spec.ts",
      "e2e/batch1-a5-*.spec.ts",
    ],
    beOwns: ["src/modules/auth/password.*"],
  },
  qa: { fe: null, be: null, feOwns: [], beOwns: [] },
};

// A git subcommand, also after `git -C <path>`, so words in commit messages or file names don't match.
const git = (subcommands) => new RegExp(String.raw`\bgit\s+(?:-C\s+(?:"[^"]*"|'[^']*'|\S+)\s+)?(?:${subcommands})\b`, "i");

const COMMON = [
  [/\b(npm|pnpm|yarn|bun)\s+(i|install|add|ci|uninstall|remove|rm|un|update|upgrade|up|dedupe|link|audit\s+fix)\b|\bnpx\s+(-y\s+|--yes\s+)?shadcn\b/i, "installing or changing packages"],
  [git("push|checkout|switch|merge|rebase|reset|stash|worktree|tag|cherry-pick|revert|clean|update-ref|filter-branch"), "git commands that push or change branches, worktrees or history"],
  [git(String.raw`branch\s+(?:-[dDmMfc]|--(?:delete|move|copy|force))`), "deleting, renaming or copying branches"],
  [/\b(psql|createdb|dropdb|pg_ctl|pg_dump|pg_restore|pg_dumpall)(\.exe)?\b|\bdrop\s+(database|schema)\b/i, "raw database commands (use the project scripts, which read your own database setting)"],
  [/\.env(?!\.example\b)\b/i, "reading .env files"],
  [/\bimpeccable(@\S+|\.cmd|\.exe)?["']?\s+(install|update|link|ignores|pin|skills|telemetry|hooks\b(?!\s+status\b))/i, "Impeccable setup commands"],
];
// Only QA runs a browser: concurrent Chromium processes stall on this machine (docs/multi-agent-plan.md).
const BUILDER_ONLY = [[/\bplaywright\b|\btest:e2e\b|visual-diff/i, "browser tests and screenshot comparisons (QA runs them, one at a time)"]];
const QA_ONLY = [
  [git("add|commit|rm|mv|restore|apply|am"), "changing files or commits (QA changes nothing)"],
  [/\bdb:(seed|reset|migrate)\b/i, "seeding, resetting or migrating databases (browser tests reset mr_garments_test themselves)"],
];

const agent = process.argv[2];
const scope = AGENTS[agent];

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const { tool_name: tool, tool_input: input = {}, cwd = process.cwd() } = JSON.parse(raw);

function block(reason) {
  process.stderr.write(`Blocked for Batch 1 agent ${agent}: ${reason}. Report the need to the coordinator instead.\n`);
  process.exit(2);
}

if (!scope) block("unknown agent id in the hook command");

const norm = (path) => posix.normalize(String(path).replaceAll("\\", "/")).toLowerCase();
const absolute = (path) => (/^[a-z]:\//i.test(String(path).replaceAll("\\", "/")) ? norm(path) : norm(`${cwd}/${path}`));
const isEnvFile = (path) => /(^|\/)\.env(\.[^/]+)?$/.test(path) && !path.endsWith("/.env.example");

const toRegex = (glob) =>
  new RegExp(
    `^${glob
      .toLowerCase()
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replaceAll("**", "\u0000")
      .replaceAll("*", "[^/]*")
      .replaceAll("\u0000", ".*")}$`,
  );
const owns = (rel, globs) => globs.some((glob) => toRegex(glob).test(rel));

function checkEdit(target) {
  if (agent === "qa") block("QA reviews and tests; it does not edit files");
  const path = absolute(target);
  if (isEnvFile(path)) block("settings files are coordinator-only");
  for (const [root, name, globs] of [
    [FE, scope.fe, scope.feOwns],
    [BE, scope.be, scope.beOwns],
  ]) {
    if (!name) continue;
    const base = `${root}${name}/`;
    if (path.startsWith(base)) {
      const rel = path.slice(base.length);
      if (owns(rel, globs)) return;
      block(`${rel} in ${name} is not one of your owned files (${globs.join(", ")})`);
    }
  }
  block(`${target} is outside your worktrees`);
}

if (tool === "Bash" || tool === "PowerShell") {
  const command = input.command ?? "";
  const rules = [...COMMON, ...(agent === "qa" ? QA_ONLY : BUILDER_ONLY)];
  for (const [pattern, reason] of rules) if (pattern.test(command)) block(reason);
} else if (tool === "Read") {
  if (isEnvFile(absolute(input.file_path ?? ""))) block("reading .env files");
} else if (tool === "Grep" || tool === "Glob") {
  // Where it searches, not what it searches for (a Grep pattern may well be "process.env").
  const where = tool === "Glob" ? `${input.path ?? ""} ${input.pattern ?? ""}` : `${input.path ?? ""} ${input.glob ?? ""}`;
  if (/\.env(?!\.example)/i.test(where)) block("searching .env files");
} else if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  checkEdit(input.file_path ?? input.notebook_path ?? "");
}
