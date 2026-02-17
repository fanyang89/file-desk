# File Desk

File Desk is a browser-based file manager with a Google Drive-like interface. It is designed for working with files in your local project directory or inside a devcontainer.

## What This Project Is For

- Manage files and folders visually: create, rename, delete, upload, and download
- Transfer files between panes with copy/move background tasks
- Work with list/grid views, sorting, multi-select, context menus, and keyboard shortcuts
- Help developers browse and organize repository files faster during day-to-day work

## How To Deploy

### 1) Local or Server Deployment (full filesystem behavior)

Note: The file API is currently provided by Vite middleware, so this mode is best for local/dev or internal environments.

```bash
bun install
bun run prisma:generate
bun run dev --host 0.0.0.0 --port 5173
```

Open `http://<your-host>:5173`.

### 2) Vercel Deployment (online demo)

This repository already includes `vercel.json`, so you can import and deploy directly from GitHub.

Note: On Vercel, the app falls back to a mock filesystem mode for demo purposes. It does not read/write your real disk, and data is not persistent.

## How To Contribute

### PR-Agent (GitHub Action)

This repository includes PR-Agent workflow at `/.github/workflows/pr-agent.yml`.

Add these repository secrets before using it:

- `PR_AGENT_OPENAI_API_BASE`: OpenAI-compatible API base URL (for example, `https://your-gateway.example.com/v1`)
- `PR_AGENT_OPENAI_KEY`: API key for that gateway
- `PR_AGENT_MODEL`: LiteLLM model id (for OpenAI-compatible gateways use `openai/<model-name>`, for example `openai/gpt-4o-mini`)

After that, open or update a PR and PR-Agent will run automatically with `auto_improve`. You can also trigger commands in PR comments, for example:

```text
/improve
```

### Local Development

```bash
bun install
bun run dev
bun run lint
bun run build
```

### Codex + Devcontainer Workflow

```bash
# 1) Reopen this repository in a devcontainer (VS Code)
# 2) Run Codex in yolo mode
codex --yolo

# 3) Run lint/build, then commit + push + create PR
bun run pr:create -- "Your commit message" "Optional PR title"
```

First time in the container, authenticate GitHub CLI:

```bash
gh auth login
```

Recommended flow: develop on a feature branch and make sure `bun run lint` and `bun run build` pass before opening a PR.
