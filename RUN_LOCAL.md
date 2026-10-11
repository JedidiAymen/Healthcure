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

These commands fetch data from official sources and verify the installed assets. CholecT50 Challenge Validation is pinned by ETag, archive SHA-256 and per-file hashes; its terms are CC BY-NC-SA 4.0, so keep it local and non-commercial. Its 1 fps sampled images are not continuous footage. The full Endoscapes archive is 6.29 GB and expands to about 7.28 GB; reserve at least 1 GB beyond the archive and extracted payload. The Appendix300 installer uses pinned HTTP ranges to retrieve one 38-second, 27 MB MP4 excerpt from its 80.77 GB CC BY 4.0 collection without downloading the full archive. The full 10.19 GB OpenKBP-Opt archive is not retained; the selected `pt_241` source files and authentic `set_1` output were range-extracted separately and are required for the flagship path below. The installed `pt_201` case has no matching second-dose prediction. Endoscapes is restricted to non-commercial scientific research under CC BY-NC-SA 4.0; FiSaV is CC BY 4.0. Keep the demo local, retain source attribution and do not redistribute raw assets. See [`docs/DEMO_ASSETS.md`](docs/DEMO_ASSETS.md) and [`docs/BLOCKERS.md`](docs/BLOCKERS.md).

For an Academy/Educator demonstration, create an isolated database and seed the local demo before launch. This creates one educator and one student, adds the student to a cohort, and adds source-bounded lesson drafts for the data installed on this computer. New random passwords are printed once in the terminal; save them locally for the demo. Only salted password hashes are stored, and no credentials or learner records are committed to Git. If an account already exists in that database, its password is not changed or shown again. See [`docs/LOCAL_ACCESS_AND_PROFILES.md`](docs/LOCAL_ACCESS_AND_PROFILES.md) for profile descriptions and sign-in steps.

```sh
export MEDFORGE_DB_PATH="$PWD/data/jury-demo.sqlite3"
apps/api/.venv/bin/python scripts/seed_demo.py
```

Keep `MEDFORGE_DB_PATH` set to this same path when launching. To create only custom accounts instead, use `scripts/create_local_learning_user.py`; it prompts for each password and does not seed a cohort or lesson drafts. Supported local roles include `student`, `educator`, `clinical_reviewer`, and `admin`. The Clinical Reviewer designation is operator-assigned for DoseTwin research review only and does not verify credentials or permit patient-care decisions.

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
- **Flagship DoseTwin:** <http://127.0.0.1:15174/studio/dosetwin/cases/openkbp%3Apt_241> (requires the separately installed `pt_241` source case and matching archived `set_1` prediction; these files and the saved report are local-only)
- DoseTwin `pt_201` benchmark viewer: <http://127.0.0.1:15174/studio/dosetwin/cases/openkbp%3Apt_201> (secondary reference path; it does not have a matching second-dose prediction)
- SurgiVision: <http://127.0.0.1:15174/studio/surgivision/cases/endoscapes%3Atrain%3A4_26200>
- FistulaGuard: <http://127.0.0.1:15174/studio/fistulaguard/cases/fisav%3Apat001>
- Educator: <http://127.0.0.1:15174/educator>
- Academy: <http://127.0.0.1:15174/academy>

The selected walkthrough is **DoseTwin `pt_241`**, as described in [`docs/FLAGSHIP_DECISION.md`](docs/FLAGSHIP_DECISION.md) and [`docs/HACKCURE_COMPLIANCE.md`](docs/HACKCURE_COMPLIANCE.md). Do not begin at `/cases/current` or substitute `pt_201`: that route opens the default benchmark case. Before presenting, follow [`docs/LOCAL_ACCESS_AND_PROFILES.md`](docs/LOCAL_ACCESS_AND_PROFILES.md) to confirm the `pt_241` archived prediction and saved comparison report in this same local database, and provision a `clinical_reviewer` account there. Account passwords are not seeded for this role; the account-creation script prompts for one. Save credentials outside the repository. If you also plan to show Academy, create student and educator accounts, then use the educator profile to review, publish, and assign a lesson draft before signing in as the student. None of these local records or credentials are included in a branch push.

The viewer paths read installed local files and call the local API. They do not require a third-party token, hosted model, remote inference service or external API. Source and publication links inside the interface require internet access if opened. Keep both services on `127.0.0.1`; do not expose the API to a LAN or the public internet. Press Ctrl+C in the launcher terminal to stop both services.

## Local-only Docker HackCure profile

Use this profile when the rehearsal must run in Docker and the host preflight must inspect the exact database used by the app. It requires Docker Engine and Docker Compose **2.24.4 or newer** because the overlay uses Compose's [`!reset` merge tag](https://docs.docker.com/reference/compose-file/merge/) to remove the default SQLCipher secret mount. Both startup and preflight reject older versions before proceeding. It keeps source mounts read-only, exposes `pt_201` as a separate viewer-only DoseTwin case, and enables the `pt_241` prediction comparison mapping only for its matching archived `set_1`. The launcher resolves local source symlinks for OpenKBP, Endoscapes, FiSaV, Appendix300, and Cholec80 into direct read-only bind mounts without copying their data; CholecT50 remains on the read-only project data mount. Missing optional sources use private empty directories and appear as requiring setup. The proxy ports bind to `127.0.0.1`; the API and broker have no published host ports. Do not use this profile for LAN access or public hosting.

Prepare the Docker images and the local `pt_241` source files on this machine before rehearsal. The launcher below does not build or pull images; it verifies the resolved Compose ports, starts only already available images, and waits up to 120 seconds for the services to run and the API health check to pass before printing the app URL. A timeout returns an error instead of reporting the stack ready. It creates the ignored `data/hackcure-docker/` directory when needed. The app applies its normal database schema migrations at startup but does **not** seed student, educator, reviewer, or admin accounts. Do not provision reviewer/student accounts as part of this setup unless the people responsible for the rehearsal explicitly arrange that separately.

```sh
npm run hackcure:start:docker
```

Open the local app at <https://localhost:8443/studio/dosetwin/cases/openkbp%3Apt_241>. Caddy uses its local certificate authority for `localhost`; trust that certificate on the demo machine before the presentation. Stop the stack with:

```sh
docker compose -f docker-compose.yml -f docker-compose.hackcure.yml down
```

This profile deliberately uses a host-bind-mounted, unencrypted SQLite demo database at `data/hackcure-docker/medforge.sqlite3`, so the host-side read-only preflight can inspect the same file as the container. Protect the folder with the machine's account permissions and full-disk encryption; do not copy it into Git, screenshots, or shared storage. This database is separate from the encrypted default Docker state volume and from the development launcher database. The OpenKBP files remain outside the database and are bind-mounted read-only from `data/` into `/datasets/`.

The Compose profile maps `openkbp:pt_241` to `/datasets/openkbp-opt/pt_241` for the API. The companion `scripts/hackcure_docker_preflight.sh` resolves that same source directory on the host and checks `data/hackcure-docker/medforge.sqlite3` with SQLite read-only/query-only settings:

```sh
npm run hackcure:preflight:docker
```

The first run is expected to report missing imported comparison state and reviewer credentials. It does not create them. The Docker preflight checks the rendered Compose host ports and the source/database profile; its doctor output also reports the development launcher's loopback setting. A passing preflight still does not replace an interactive Docker rehearsal. `start_hackcure_docker.sh` independently checks the rendered Compose config and refuses to start if any host-published port is not bound to `127.0.0.1`.

Once the Docker profile database contains the prepared walkthrough state, use [`docs/HACKCURE_BACKUP_RESTORE.md`](docs/HACKCURE_BACKUP_RESTORE.md) to create a local-only archive and verify it in a disposable directory. That check never overwrites the active database and does not replace the offline second-machine rehearsal.

## Local preflight

Before rehearsal, use the targeted HackCure preflight from the project root:

```sh
npm run doctor -- --hackcure-preflight
```

It checks the manifest-hashed `pt_241` source and archived `set_1` file; a matching imported artifact and saved comparison report in the selected local database; a local reviewer/admin role with sign-in credentials; and the local launcher's loopback-only configuration. It also reports whether an optional Academy lesson is already published and assigned to a credentialed student. The Academy check is informational and does not affect the command's exit status. A failed required check exits nonzero and gives a local path plus a short reason.

This mode does not start services, apply migrations, create or change accounts, passwords, learner records, review decisions or the demo database, download assets, or validate clinical credentials or data-display rights. It opens the selected database with SQLite read-only/query-only settings. The default database is `data/local.sqlite3`; set `MEDFORGE_DB_PATH` before running the preflight if the app will use a different database, and keep that same path when launching. For the Docker profile, use `scripts/hackcure_docker_preflight.sh` so both the host database and source mapping match the Compose bind mounts. The `pt_241` source path otherwise follows `MEDFORGE_OPENKBP_FULL_CASES_JSON` when configured, or checks `data/openkbp-opt/pt_241`. A viewer-only `MEDFORGE_OPENKBP_CASES_JSON` map is not sufficient for the prediction-comparison walkthrough and is reported as a blocker. Run the check again after preparing local state. It is not a live-service, visual, keyboard, or screen-size review.

With the launcher running, open another terminal in the project root and check general machine readiness plus source-backed routes:

```sh
# Run these commands from the cloned project root.
npm run doctor -- --output docs/evidence/machine-readiness.json
MEDFORGE_API_URL=http://127.0.0.1:18081 MEDFORGE_WEB_URL=http://127.0.0.1:15174 npm run smoke:local
```

The smoke command checks loopback health, the three source-backed module APIs and application route shells. It does not replace interactive keyboard, screen-size or visual review. For a software build check, run `npm run lint`, `npm run test`, `python3 -m pytest -q apps/api/tests`, `npm run contracts:check` and `npm run build` before the event.

## Demo boundaries

- DoseTwin shows the installed OpenKBP benchmark reference arrays, not a delivered treatment plan or native DICOM orientation.
- SurgiVision's CholecT50 review shows official tool-tip boxes, action triplets and phase labels on the exact sparse source frames; Play samples walks only those available images and preserves the source-time gaps. These are dataset reference annotations, not MEDFORGE model predictions. Endoscapes shows its own expert annotations, not model predictions or surgical clearance. Both sources are sampled still sequences, not continuous video.
- FistulaGuard shows measured FiSaV signals and descriptive analyses. Units are uncalibrated; no stenosis label or diagnosis is exposed.
- SurgiVision's continuous player shows one separately attributed CC BY 4.0 Appendix300 laparoscopic appendectomy excerpt (38.1 seconds). It is not cholecystectomy footage and has no aligned annotations, masks or model results. CholecT50's stills have their own authentic source labels, but are not aligned to this player. Endoscapes itself remains a sampled-still sequence, not a playable video.
- OpenKBP publication, CVS checkpoint execution, external hosting and public/demo data display remain gated by the conditions in `docs/BLOCKERS.md` and `docs/RELEASE_CHECKLIST.md`.
