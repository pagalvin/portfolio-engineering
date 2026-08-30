# ADR 0005: Adopt Tailwind CSS and shadcn/ui for frontend UI

- Status: draft
- Date: 2026-08-30
- Audience: [architect-agents, coding-agents, testing-agents, uxd, humans]

## Applicable When

- Creating or changing React frontend components, layouts, styling, or reusable UI primitives.
- Adding a frontend dependency that provides UI styling, components, icons, or interaction primitives.
- Migrating the existing frontend styles in [index.css](../../apps/frontend/src/index.css) or [App.css](../../apps/frontend/src/App.css).
- Not applicable to third-party embedded UI that cannot use the application styling system, or narrowly scoped global/base styles required to initialize Tailwind CSS.

## Context

- The frontend is a React, TypeScript, and Vite application, but it currently has no Tailwind CSS or shadcn/ui dependencies.
- The scaffold uses semantic CSS custom properties in [index.css](../../apps/frontend/src/index.css) and component-specific styles in [App.css](../../apps/frontend/src/App.css).
- Future product work needs consistent, accessible, composable components without repeatedly designing low-level controls.
- The project needs a single styling and component direction while preserving the existing semantic visual language during an incremental migration.

## Decision Statement

Adopt Tailwind CSS as the standard frontend styling system and shadcn/ui as the standard source of accessible, composable application UI primitives. Maintain the existing semantic design-token vocabulary as Tailwind theme tokens and use shadcn/ui components as owned, repository-local source that can be composed and adapted to product needs.

Migrate existing frontend styling incrementally as features are changed. Keep plain CSS limited to Tailwind initialization, global base styles, and documented exceptional cases; do not rewrite working scaffold styles solely to complete the migration.

## Do

- Configure Tailwind CSS using the current Vite-supported integration and add its generated/base stylesheet at the frontend entry point.
- Map semantic application design tokens to Tailwind theme tokens and use semantic token names in components.
- Add shadcn/ui components through its supported CLI/configuration and keep generated component source under version control.
- Prefer shadcn/ui primitives and Tailwind utility composition for interactive components, layout, responsive behavior, and variants.
- Preserve or improve keyboard interaction, visible focus, semantic HTML, labels, status messaging, contrast, and responsive behavior when migrating UI.
- Migrate relevant existing CSS while implementing a feature, and remove superseded rules only when the migrated UI is verified.
- Run the frontend's existing typecheck, lint, and build commands after changing the UI foundation or frontend components.

## Do Not

- Do not add a second utility CSS framework, component library, or conflicting token system without a new ADR.
- Do not introduce new component-specific CSS files or expand [App.css](../../apps/frontend/src/App.css) for ordinary component styling.
- Do not replace existing semantic tokens with arbitrary literal colors, spacing, or typography values.
- Do not perform a broad style-only rewrite of working frontend pages merely to migrate to Tailwind CSS.
- Do not assume a shadcn/ui component is accessible after customization; retain and verify its accessible behavior.
