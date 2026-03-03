# Global Guide

- You are in a Windows PowerShell environment. Prefer PowerShell commands first.
- Respond to the user in Chinese.

# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vue 3 + Vite + TypeScript frontend app.
- `src/main.ts`: application bootstrap.
- `src/App.vue`: root component.
- `src/views/`: page-level views.
- `src/components/`: reusable UI components (`src/components/icons/` for icon components).
- `src/router/index.ts`: route definitions.
- `src/stores/`: Pinia stores.
- `src/assets/`: global styles and static assets.
- `public/`: static files served as-is.

Use the `@/` alias (configured in `tsconfig.app.json`) for imports from `src`.

## Build, Test, and Development Commands
Run commands from the repository root:
- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server with hot reload.
- `npm run build`: run type-check then build production bundle.
- `npm run build-only`: build without type checking.
- `npm run preview`: preview production build locally.
- `npm run type-check`: run `vue-tsc --build`.
- `npm run lint`: run Oxlint + ESLint with auto-fix.
- `npm run format`: format files in `src/` via Prettier.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; max line length: 100 (`.editorconfig`).
- Prettier: `semi: false`, `singleQuote: true`, `printWidth: 100`.
- ESLint: Vue essential + TypeScript recommended + Oxlint integration.
- Vue SFC files: PascalCase (example: `ProductCard.vue`).
- Composables and utility helpers: camelCase (example: `useCartState.ts`).
- Keep route and store module names descriptive and domain-based.

## Testing Guidelines
A dedicated test runner is not configured yet. For now:
- Treat `npm run type-check` and `npm run lint` as required quality gates.
- If adding tests, prefer Vitest and place specs under `src/**/__tests__/` using `*.spec.ts` naming.
- Add tests for new business logic and critical state or store behavior.

## Commit & Pull Request Guidelines
Use Conventional Commits:
- `feat: add product search filters`
- `fix: handle empty cart state on refresh`

Pull requests should include:
- A clear summary and scope.
- The linked issue or task ID.
- Screenshots or a short recording for UI changes.
- Confirmation that `npm run lint` and `npm run build` pass.

## Security & Configuration Tips
- Do not commit secrets or tokens.
- Keep environment-specific values in local env files and document required keys in PR descriptions.

## API Integration Rule
- Implement frontend code against backend APIs defined in the installed Swagger document.
- `vite.config.ts` already defines the backend gateway; all frontend requests must start with `/api`.
- Add `/{service-name}` after `/api` based on the target Swagger document (for example, `swagger-auth.json` -> `/api/auth`, `swagger-order.json` -> `/api/order`).

## Skills
A skill is a set of local instructions stored in a `SKILL.md` file. Use the listed skills when the request clearly matches their purpose or the user names them explicitly.

### Available Skills
- `skill-creator`: guide for creating or updating Codex skills that extend capabilities with specialized workflows or tool integrations. File: `C:/Users/27685/.codex/skills/.system/skill-creator/SKILL.md`
- `skill-installer`: guide for listing installable skills or installing a curated skill or a GitHub repo skill into `$CODEX_HOME/skills`. File: `C:/Users/27685/.codex/skills/.system/skill-installer/SKILL.md`

### How To Use Skills
- Read only the relevant parts of the referenced `SKILL.md`.
- Resolve relative paths from the skill directory first.
- Load only the specific referenced files you need.
- Prefer reusing scripts, templates, and assets provided by the skill.
- If multiple skills apply, use the minimal set and state the order.
- If a skill is missing or cannot be applied cleanly, note it briefly and continue with the best fallback.
