# UX-33 — Switch workspaces from the global shell

## Change

Added a persistent header selector for Professional Studio, Student Academy, and Educator Studio, replacing the old button that only linked back to the currently open workspace. The selector remains visible on phones and uses a short current-role label there. Choosing a learning workspace navigates to its route; the existing role gate still requires the locally provisioned account. Navigation does not sign in, grant access, or change session state.

The existing role-specific sidebars remain in place. Case search, route structure, and role authorization are unchanged.

## Verification

- `npx playwright test tests/e2e/workspace-shell.spec.ts --grep "header workspace switcher" --workers=1` — **1 passed** at 1440×900, 768×1024, and 390×844. It switches through all three workspaces, verifies the student/educator sign-in gates, returns to Professional Studio, and checks for horizontal overflow.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed; the existing vtk.js large-chunk and React Compiler directive warnings remain.
- Actual app captures use the installed Appendix300 video and source event at 00:23: `.local-review/UX-33/header-switcher-1440x900.png`, `header-switcher-768x1024.png`, and `header-switcher-390x844.png` (ignored by Git).

## Component source

- Existing generated shadcn/Base Nova `Select` composition in `src/components/ui/select.tsx`.
- Existing `@base-ui/react` version `1.8.0`, MIT license; no new package. The Select follows the official [shadcn Select documentation](https://ui.shadcn.com/docs/components/base/select) and [Base UI value formatting guidance](https://base-ui.com/react/components/select#formatting-the-value).
- No API, dataset, medical calculation, or permission changes.
