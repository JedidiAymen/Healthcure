# UX-55: Clinician-facing entry hero

## Change

The landing page now opens with a clinician-facing visual entry: a radiology review photograph paired with a smaller operating-room photograph, followed by the Professional Studio, Student Academy, and Educator Studio choices. The copy names the intended specialist audiences and points them toward separate source-backed research workspaces.

Both photos are representative context only. They do not show MEDFORGE staff, research participants, or evidence from the scientific datasets. Their full credits and license notes are in `docs/IMAGE_CREDITS.md`. The real Endoscapes, OpenKBP, and FiSaV evidence atlas remains below the workspace choices.

## Design rationale

The approved Cobalt / Porcelain palette remains in place. The entry uses a large clinical-setting image as its visual anchor and restrained cobalt framing, while the audience description and research-only caveat stay adjacent to it. At narrow widths the image leads the text and the layout stacks without hiding the workspace routes. Existing shadcn `Badge` components and Tailwind utilities provide the interface treatment; no new UI library or staff identities were introduced.

## Existing component and asset sources

- shadcn/ui Base Nova `Badge`: generated project source at `src/components/ui/badge.tsx`, selected by `components.json`; upstream shadcn/ui source is [MIT licensed](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md). Its local implementation is built on `@base-ui/react` 1.8.0 (MIT). The hero icon is Lucide React 1.53.0 (ISC). No component package was added for this change.
- Tailwind CSS 4.3.3 (MIT), already pinned in `package.json`/`package-lock.json`; the hero layout uses its existing utility pipeline and semantic project tokens.
- The two bundled representative photos and their Unsplash license links are recorded in [`IMAGE_CREDITS.md`](../IMAGE_CREDITS.md). No remote image request was added.

## Verification

- `npm run typecheck`, `npx eslint src/pages/Pages.tsx`, and `git diff --check` passed.
- The running landing page returned HTTP 200 at 1440×900, 768×1024, and 390×844. Both hero photos loaded, the viewport had no horizontal overflow, and no browser page errors were recorded.
- Screenshots: `.local-review/PR-UX-55-clinician-entry/home-1440.png`, `home-768.png`, and `home-390.png` (local review artifacts, ignored by Git).

## Files

- `src/pages/Pages.tsx`
- `docs/ui/PR-UX-55-clinician-entry-hero.md`
- `docs/IMAGE_CREDITS.md` (existing asset record; unchanged)
- `.local-review/PR-UX-55-clinician-entry/home-1440.png`, `home-768.png`, `home-390.png` (local review captures; ignored by Git)
