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
- Composables/util helpers: camelCase (example: `useCartState.ts`).
- Keep route and store module names descriptive and domain-based.

## Testing Guidelines
A dedicated test runner is not configured yet. For now:
- Treat `npm run type-check` and `npm run lint` as required quality gates.
- If adding tests, prefer Vitest and place specs under `src/**/__tests__/` using `*.spec.ts` naming.
- Add tests for new business logic and critical state/store behavior.

## Commit & Pull Request Guidelines
Git history is not available in this workspace snapshot (`.git` metadata is missing), so use Conventional Commits:
- `feat: add product search filters`
- `fix: handle empty cart state on refresh`
PRs should include:
- Clear summary and scope.
- Linked issue/task ID.
- Screenshots or short recordings for UI changes.
- Confirmation that `npm run lint` and `npm run build` pass.

## Security & Configuration Tips
- Do not commit secrets or tokens.
- Keep environment-specific values in local env files and document required keys in PR descriptions.

## API Integration Rule
- Implement frontend code against backend APIs defined in the installed Swagger document.
- `vite.config.ts` already defines the backend gateway; all frontend requests must start with `/api`.
- Add `/{service-name}` after `/api` based on the target Swagger document (for example, `swagger-auth.json` -> `/api/auth`, `swagger-order.json` -> `/api/order`).
