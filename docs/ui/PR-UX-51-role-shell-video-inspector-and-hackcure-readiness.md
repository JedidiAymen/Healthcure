# UX-51 — Role-specific shell, source-tied surgical video, and HackCure demo guide

**Date:** 2026-10-10  
**Branch:** `feat/experiments-run-workspace`  
**Status:** local feature-branch milestone; not a deployment or organizer approval.

## What changed

- Reorganized the existing shadcn Sidebar into three role-specific navigation sets: Professional Studio routes and clinical specialties; Academy learning and progress; Educator lessons, assignments and submissions. The header workspace selector explains that navigation does not grant access; the existing route gates and session/search behavior remain authoritative. Signed-in profile identity and sign-out are visible in the shell.
- Reshaped SurgiVision's native-video mode around the actual video and a current-frame evidence inspector. Cholec80 phase labels continue to follow the exact 25 fps source frame. Appendix300 event text, six-decimal timestamp and grade stay tied to its single publisher annotation; the overlay is shown only at the source timestamp tolerance. The inspector distinguishes source labels from unavailable model output and records clip identity, license and hash. Sampled images, learner protections and source annotation geometry were left intact.
- Aligned local demo instructions with the selected HackCure story: explicitly open the `pt_241` DoseTwin route, verify its matching archived `set_1` artifact and saved comparison report in the same local database, and provision the reviewer account there. Academy is an optional path that needs separately saved student/educator credentials and an educator-published, assigned lesson. `pt_201` is documented as a secondary viewer with no matching second-dose archive.
- Tightened the README, source manifest, compliance snapshot and L3 dossier to distinguish local evidence from clean-clone, hosted-CI, jury-rehearsal, legal and clinical validation. User-supplied planning materials remain distinguished from organizer approval; the primary organizer cahier PDF was not available in this checkout.

## Files changed

- `src/components/Shell.tsx`
- `src/pages/SurgiViewer.tsx`
- `README.md`, `RUN_LOCAL.md`
- `docs/DEMO_ASSETS.md`, `docs/LOCAL_ACCESS_AND_PROFILES.md`
- `docs/HACKCURE_COMPLIANCE.md`, `docs/L3_DEPLOYMENT_DOSSIER.md`
- `docs/STATUS.md`, `docs/PROGRESS.md`, `docs/RELEASE_CHECKLIST.md`

## Components and licenses

No dependency was installed. The shell uses the checked-in shadcn/Base UI component source (Sidebar, Select, Badge and Button), Tailwind utilities, and the existing `@base-ui/react` 1.8.0 (MIT) package. The video player remains the existing `@videojs/react` 10.0.1 (Apache-2.0) integration. React 19.3.0 (MIT) and Tailwind 4.3.3 (MIT) were already pinned. The exact publisher media and source labels remain supplied by the local, checksum-verified source APIs.

## Visual review evidence

Actual installed-source Cholec80 and Appendix300 review captures are in the ignored, local-only `.local-review/PR-UX-51-surgivision-video-inspector/` directory:

- `surgivision-inspector-1440.png` and `surgivision-inspector-390.png`
- `surgivision-appendix-exact-1440.png` and `surgivision-appendix-exact-390.png`

The Appendix300 capture verifies the inspector and player at the publisher's exact `23.161489 s` event. The native video and source annotation were also reviewed in sampled/annotated still modes at desktop and phone widths. Shell review covered Home at 390×844 and 768×1024, Academy's phone navigation drawer, and the Educator assignments route at tablet width. These browser captures were inspected but not saved as files. Raw media and all screenshots remain local and are not included in Git.

## Verification actually performed

- `npm run typecheck -- --pretty false` — passed.
- `git diff --check` — passed.
- Running-app visual review of the source-backed Cholec80 and Appendix300 video routes at 1440px and 390px; exact Appendix300 event timestamp, publisher label, responsive layout and no horizontal overflow/page errors confirmed.
- Running-app role-shell review at the widths and routes listed above. No authenticated Academy/Educator session was created or changed for this pass.
- No broad test suite, clean-clone rehearsal, organizer review, public deployment or clinical validation was performed.

## HackCure readiness still open

The local `pt_241` walkthrough is documented but still requires preflight on the exact demo machine: its source arrays, archived output and saved report are not in Git; reviewer credentials and the demo database are machine-local. A portable/synthetic L2 demo package and independent clean-clone/jury rehearsal are not evidenced. The L3 dossier remains a planning draft without validated payer interviews, cost estimates, governance decisions or legal/regulatory approval. Keep the demo local and research-only until the applicable source, audience and institutional gates are resolved.
