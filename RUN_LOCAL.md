# Run MEDFORGE locally

This guide is for the local research and education workspace in this checkout. It covers a reproducible local demo using the source datasets already installed under `data/`. MEDFORGE is not clinical software and the local demo is not approved for public hosting or external dataset display.

## Before demo day

Use a supported local machine with the project dependencies and verified source files installed before going offline. From the project root:

```sh
# Run these commands from the cloned project root.
python3 -m venv apps/api/.venv
apps/api/.venv/bin/python -m pip install -r apps/api/requirements-test.txt
npm ci
npm run doctor -- --output docs/evidence/machine-readiness.json
```

The doctor report checks local runtime, disk, dataset manifests, installed source files and the isolated CVS worker. It does not download assets or establish dataset, checkpoint or external-display rights. The review computer currently has verified OpenKBP cases, the full Endoscapes release (including 1 fps sampled still sequences and BBox201 annotations), the CholecT50 Challenge Validation package (five clips with sparse labeled frames and tool-tip boxes), one licensed Appendix300 continuous video excerpt, and all 59 FiSaV CSV recordings. Raw dataset files remain local and ignored by Git. The CVS-AdaptNet model action remains gated; no model download is needed for the demo.

If a source folder is missing, acquire it while connected to the internet and only after checking the source-specific terms:

```sh
apps/api/.venv/bin/python scripts/acquire_openkbp_pt201.py
apps/api/.venv/bin/python scripts/acquire_endoscapes_bbox201.py --split all
apps/api/.venv/bin/python scripts/acquire_fisav_sample.py --all-recordings
apps/api/.venv/bin/python scripts/acquire_endoscapes_full_release.py
apps/api/.venv/bin/python scripts/acquire_appendix300_sample.py
apps/api/.venv/bin/python scripts/acquire_cholect50_challenge_validation.py
```

These commands fetch data from official sources and verify the installed assets. CholecT50 Challenge Validation is pinned by ETag, archive SHA-256 and per-file hashes; its terms are CC BY-NC-SA 4.0, so keep it local and non-commercial. Its 1 fps sampled images are not continuous footage. The full Endoscapes archive is 6.29 GB and expands to about 7.28 GB; reserve at least 1 GB beyond the archive and extracted payload. The Appendix300 installer uses pinned HTTP ranges to retrieve one 38-second, 27 MB MP4 excerpt from its 80.77 GB CC BY 4.0 collection without downloading the full archive. OpenKBP-Opt remains a separate blocked 10.19 GB download; the installed single `pt_201` case does not include a second-dose prediction archive. Endoscapes is restricted to non-commercial scientific research under CC BY-NC-SA 4.0; FiSaV is CC BY 4.0. Keep the demo local, retain source attribution and do not redistribute raw assets. See [`docs/DEMO_ASSETS.md`](docs/DEMO_ASSETS.md) and [`docs/BLOCKERS.md`](docs/BLOCKERS.md).

For an Academy/Educator demonstration, provision dedicated local accounts before the event. This prompts for a password twice; only a salted hash is stored. See [`docs/LOCAL_ACCESS_AND_PROFILES.md`](docs/LOCAL_ACCESS_AND_PROFILES.md) for profile descriptions, sign-in steps and credential handling. Use the same database path for provisioning and launch:

```sh
export MEDFORGE_DB_PATH="$PWD/data/jury-demo.sqlite3"
apps/api/.venv/bin/python scripts/create_local_learning_user.py --username educator --display-name "Demo Educator" --role educator
apps/api/.venv/bin/python scripts/create_local_learning_user.py --username learner --display-name "Demo Learner" --role student
```

Do not use these sample names on a shared or production service. The API has no general research-route RBAC or production identity system.

## Offline demo launch

Run from the project root after dependencies and assets are present. Choose two unused local ports if the defaults are occupied. These settings keep the API bound to loopback and use an isolated demo database:

```sh
# Run these commands from the cloned project root.
export MEDFORGE_DB_PATH="$PWD/data/jury-demo.sqlite3"
export MEDFORGE_API_PORT=18081
export MEDFORGE_WEB_PORT=15174
./scripts/start_local.sh
```

During the demo, open these local routes:

- Workspace: <http://127.0.0.1:15174/studio>
- DoseTwin: <http://127.0.0.1:15174/studio/dosetwin/cases/openkbp%3Apt_201>
- SurgiVision: <http://127.0.0.1:15174/studio/surgivision/cases/endoscapes%3Atrain%3A4_26200>
- FistulaGuard: <http://127.0.0.1:15174/studio/fistulaguard/cases/fisav%3Apat001>
- Educator: <http://127.0.0.1:15174/educator>
- Academy: <http://127.0.0.1:15174/academy>

The viewer paths read installed local files and call the local API. They do not require a third-party token, hosted model, remote inference service or external API. Source and publication links inside the interface require internet access if opened. Keep both services on `127.0.0.1`; do not expose the API to a LAN or the public internet. Press Ctrl+C in the launcher terminal to stop both services.

## Local preflight

With the launcher running, open another terminal in the project root and check readiness plus source-backed routes:

```sh
# Run these commands from the cloned project root.
npm run doctor -- --output docs/evidence/machine-readiness.json
MEDFORGE_API_URL=http://127.0.0.1:18081 MEDFORGE_WEB_URL=http://127.0.0.1:15174 npm run smoke:local
```

The smoke command checks loopback health, the three source-backed module APIs and application route shells. It does not replace interactive keyboard, screen-size or visual review. For a software build check, run `npm run lint`, `npm run test`, `python3 -m pytest -q apps/api/tests`, `npm run contracts:check` and `npm run build` before the event.

## Demo boundaries

- DoseTwin shows the installed OpenKBP benchmark reference arrays, not a delivered treatment plan or native DICOM orientation.
- SurgiVision's CholecT50 review shows official tool-tip boxes, action triplets and phase labels on the exact sparse source frames; these are dataset reference annotations, not MEDFORGE model predictions. Endoscapes shows its own expert annotations, not model predictions or surgical clearance. Both sources are sampled still sequences, not continuous video.
- FistulaGuard shows measured FiSaV signals and descriptive analyses. Units are uncalibrated; no stenosis label or diagnosis is exposed.
- SurgiVision's continuous player shows one separately attributed CC BY 4.0 Appendix300 laparoscopic appendectomy excerpt (38.1 seconds). It is not cholecystectomy footage and has no aligned annotations, masks or model results. CholecT50's stills have their own authentic source labels, but are not aligned to this player. Endoscapes itself remains a sampled-still sequence, not a playable video.
- OpenKBP publication, CVS checkpoint execution, external hosting and public/demo data display remain gated by the conditions in `docs/BLOCKERS.md` and `docs/RELEASE_CHECKLIST.md`.
