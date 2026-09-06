# Patch 2.74.216 — flush sticky bars and central scrollbar

## Scope

This patch changes only browser layout and scrollbar styling. Parser and persisted product behavior are unchanged.

## Behavior

- The central workspace and document scrollbar use the same narrow neutral thumb and hover treatment as the sidebars.
- Sidebar top padding belongs to the scroll-away introduction instead of the scrolling container.
- The sticky library import bar and encounter combat bar use `top: 0` with no top margin or internal top padding.
- When the introductions leave the viewport, the visible controls sit directly against the top edge.
- Current-turn automatic scrolling continues to reserve exactly the computed sticky combat-bar height.

## Validation

- TypeScript strict typecheck.
- Core build and complete compiled Node test suite.
- Frontend TypeScript and Vite production build.
