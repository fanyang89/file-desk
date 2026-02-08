# Repository Guidelines

## Project Structure & Module Organization
Core code lives in `src/`:
- `src/components/` UI by feature (`FileList`, `Toolbar`, `Dialogs`, etc.)
- `src/store/` Zustand state (`file-store.ts`)
- `src/api/` Vite middleware backend (`fs-api-plugin.ts`, routes, fs utilities)
- `src/lib/`, `src/hooks/`, `src/types/` shared utilities, hooks, and types

Build output goes to `dist/`. Static entry files are `index.html` and `src/main.tsx`. Use the `@/` alias (configured in `vite.config.ts`) for imports from `src`.

## Build, Test, and Development Commands
- `bun install` installs dependencies.
- `bun run dev` starts the Vite dev server (frontend + API middleware).
- `bun run lint` runs ESLint for TypeScript/React rules.
- `bun run build` runs TypeScript project checks and production build.
- `bun run preview` serves the production build locally.

Before committing, run:
- `bunx biome format --write .`
- `bun run lint --fix`

## Coding Style & Naming Conventions
Use TypeScript with strict settings (`tsconfig.app.json`), functional React components, and hooks.
- Indentation: 2 spaces.
- Strings: single quotes.
- Semicolons: omit unless required.
- Component files: `PascalCase.tsx` (`FileList.tsx`).
- Hooks: `useSomething.ts` (`useKeyboardShortcuts.ts`).
- Shared modules and stores: descriptive kebab-case (`file-store.ts`, `api-client.ts`).

## Testing Guidelines
There is currently no automated test suite in CI. Quality gate is:
1. `bun run lint`
2. `bun run build`

For behavior changes, include manual verification steps in your PR (for example: create folder, rename file, switch list/grid view, open preview). If you add tests, prefer `*.test.ts(x)` near the related module.

## Commit & Pull Request Guidelines
Follow existing history style: short, imperative commit subjects (for example, `Add file preview feature`, `Fix lint error in RenameDialog`).

For PRs, include:
- Clear summary of user-visible changes
- Linked issue (if applicable)
- Manual test steps
- Screenshots/GIFs for UI changes

Ensure CI (`lint` + `build`) passes before requesting review.
