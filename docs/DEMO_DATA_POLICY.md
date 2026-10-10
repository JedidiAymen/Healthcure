# Demo data policy

What each dataset may show, and where. **The deployment is local only**: the demo PC runs the Docker stack. There is no public or hosted site (decision of 2026-10-10, recorded in `docs/FLAGSHIP_DECISION.md`).

Licence terms below come from each source's own documentation, as recorded in `docs/BLOCKERS.md` and the dataset manifests under `data/`. Anything marked *verify* has not been confirmed on this machine.

| Dataset | Licence and terms | Local Docker demo (jury, on the demo PC) | Screenshots or slides | Public or hosted | Attribution to show |
|---|---|---|---|---|---|
| OpenKBP `pt_201` (DoseTwin) | No dataset licence was found. The repository's MIT licence covers code only. Personal hackathon use. | Yes, from read-only mounts | Avoid raw CT and dose images in slides that leave the room. Prefer numbers (DVH values, cross-check table) or a labelled synthetic phantom. | No | OpenKBP repository and pinned commit (shown in the app) |
| OpenKBP-Opt `pt_241` reference and archived set_1 prediction (DoseTwin) | Archive data terms not established (`docs/BLOCKERS.md`) | Yes, if installed on the demo PC, badged ARCHIVED PREDICTION (not our inference) | Same as above | No | OpenKBP-Opt repository; state "archived prediction, checkpoint hash not published" |
| Endoscapes (SurgiVision) | CC BY-NC-SA 4.0, non-commercial scientific research | Yes, non-commercial hackathon demo | Allowed with attribution, non-commercial only, and share-alike for derived images | No (no redistribution of the sample) | Endoscapes authors and licence (shown in the app) |
| Appendix300 clip (SurgiVision) | CC BY 4.0 | Yes | Yes, with attribution | Not planned | Kolbinger et al., Scientific Data 2026, doi 10.1038/s41597-026-07593-6 |
| CholecT50 validation frames (SurgiVision) | *Verify licence before display* (not installed on this machine) | Only after the licence is checked | Not until verified | No | Nwoye et al. 2022 (shown in the app) |
| FiSaV recordings and patient sheet (FistulaGuard) | CC BY 4.0 (OSF project HYPFR) | Yes | Yes, with attribution. Never show individual patient-sheet rows. Use aggregate counts only (40 Y, 19 N). | Not planned | Parlato, Centracchio, Cinotti, Andreozzi, FiSaV dataset (OSF, doi 10.17605/OSF.IO/HYPFR) |

## Rules

1. Raw research files never leave the demo PC and never enter Git (the `data/` folder is ignored) or a Docker image (`.dockerignore` excludes `data/`). They reach containers only through read-only mounts.
2. Anything that might leave the machine (slides, screenshots, recordings) follows the "Screenshots or slides" column above.
3. **If DoseTwin must be shown off the demo PC**, the cheapest honest option is a synthetic phantom, labelled "SYNTHETIC PHANTOM, NOT ANATOMY, NOT A TREATMENT PLAN". It consists of:
   - a 128 cube water-cylinder CT;
   - one spherical target and two cylindrical organs at risk;
   - a dose with a smooth falloff from the target.
   The existing code computes its DVHs. It is not built yet, because no off-machine display is planned.
4. Synthetic data is always labelled synthetic, on screen and in exports, and is never presented as measured.
5. Demo accounts are created by `scripts/seed_demo.py` in the encrypted local database. Their passwords are printed once and are never placed in slides.
