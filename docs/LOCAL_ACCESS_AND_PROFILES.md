# Open MEDFORGE and use its profiles

This guide is for the local review checkout. MEDFORGE is a research and education application, not clinical software. Keep its API on this computer (`127.0.0.1`); general research reads remain local-only and are not protected by a complete account policy.

## Start the app

From the project root, install dependencies once and launch both services:

```sh
cd ~/Documents/projects/HealthCure/medforge-dosetwin-vtkjs-spike
python3 -m venv apps/api/.venv
apps/api/.venv/bin/python -m pip install -r apps/api/requirements-test.txt
npm ci
./scripts/start_local.sh
```

Open <http://127.0.0.1:5173>. Leave the terminal running; press Ctrl+C there to stop the app. If the default ports are busy, set `MEDFORGE_API_PORT` and `MEDFORGE_WEB_PORT` before launching. The complete offline setup, source readiness checks and data limitations are in [`RUN_LOCAL.md`](../RUN_LOCAL.md).

## Choose a profile

| Profile | Open | Sign-in | What it is for |
| --- | --- | --- | --- |
| Professional Studio | <http://127.0.0.1:5173/studio> | No account | Local research case registry and the SurgiVision, DoseTwin and FistulaGuard workspaces. Source availability and use limits are shown in each workspace. |
| DoseTwin research reviewer (flagship `pt_241`) | <http://127.0.0.1:5173/studio/dosetwin/cases/openkbp%3Apt_241> | Clinical Reviewer or admin account | Inspect the matching reference and archived `set_1` output, saved comparison report, and source-backed review. Requires the locally installed `pt_241` files and report. The local reviewer designation does not verify clinical credentials. |
| Student Academy | <http://127.0.0.1:5173/academy> | Student account | Assigned source-backed investigations, learner progress and optional private gamification. A lesson appears only after an educator publishes and assigns it. |
| Educator Studio | <http://127.0.0.1:5173/educator> | Educator account | Author and review lessons, manage cohorts, publish learner-safe versions, assign work and grade submissions. |

The app supports **Professional Studio** research browsing without sign-in, a **Clinical Reviewer** account for DoseTwin research-review decisions, and local **student** and **educator** accounts for learning workflows. General research writes (imports, comparisons and reports) still require educator/admin; the Clinical Reviewer role is limited to DoseTwin review, export and personal audit routes. This operator-assigned local role does not verify a medical credential or qualification and does not authorize patient care. Professional Studio browsing is not a separate researcher login. There are no default or shared passwords in a fresh database. To prepare an isolated Academy/Educator demo, seed its database after installing the desired source data:

```sh
export MEDFORGE_DB_PATH="$PWD/data/jury-demo.sqlite3"
apps/api/.venv/bin/python scripts/seed_demo.py
```

When new accounts are created, this prints one randomly generated password for `demo-educator` and one for `demo-student`. Save them locally in a password manager or provide them to the people using this local demo; the script will not print them again if the accounts already exist. The seeder also creates a demo cohort, adds the student to it, and creates source-backed lesson **drafts** for installed datasets. Drafts still require educator review and publishing before they appear in Academy. Do not put generated passwords in Git, issues, screenshots, or a shared database. A friend setting up their own checkout should run the command on that machine to get separate credentials.

## Direct review routes

After the app is running, these routes make it quick to inspect the current work:

| Screen | Route | Access | What to review |
| --- | --- | --- | --- |
| Model Lab | <http://127.0.0.1:5173/studio/models> | Professional Studio; no account | Select an installed compatible case and inspect the API-returned operation blockers. A blocked method has no run action. |
| Experiments | <http://127.0.0.1:5173/studio/experiments> | Professional Studio; no account | Run the enabled OpenKBP reference summary. It computes benchmark statistics and is not a prediction model. |
| Educator Assignments | <http://127.0.0.1:5173/educator/assignments> | Educator account | Search/filter assigned lessons by cohort and due date; open the matching review queue. |
| Educator Submissions | <http://127.0.0.1:5173/educator/submissions> | Educator account | Choose an assignment, search learners, filter by review state, then inspect source evidence and manually score the rubric. |

The Model Lab reports current local gates; for example, CVS-AdaptNet remains blocked when its verified checkpoint/worker prerequisites or checkpoint-specific research terms are absent. It does not claim an inference result. SurgiVision includes the full-rate Cholec80 video01 source with exact frame-matched phase labels, plus a separate Appendix300 appendectomy excerpt with one publisher-timed event and grade. CholecT50 challenge validation data remains sampled still frames; its boxes and triplets stay attached to those matching images only.

On the current review branch, [SurgiVision](http://127.0.0.1:5173/studio/surgivision/cases/current) shows source-selectable full-rate Cholec80 and Appendix300 videos, the CholecT50 sampled review, and Endoscapes annotated stills. Cholec80's 25 fps phase label follows its exact displayed source frame. Its tool-presence annotations are only 1 fps and are not drawn over intervening frames. Appendix300 has one verified source event at 00:23 and a final laparoscopic grade; **Jump to source event** seeks the video and shows the publisher annotation over the matching frame. It is a separate appendectomy clip and has no instrument masks or phase labels. Install the 693 MB compressed Cholec80 video plus its phase file from CAMMA's CC BY-NC-SA 4.0 archive with `python3 scripts/acquire_cholec80_sample.py`; the range downloader fetches only one video and matching labels from the 75 GB upstream ZIP. It verifies the upstream ETag, exact range responses, ZIP CRCs, and file SHA-256 values. Files remain in ignored local `data/cholec80/` and are not pushed to GitHub. The Endoscapes stills remain separate recordings and labels. In [Evidence Reports](http://127.0.0.1:5173/studio/reports), the open actions restore saved, source-matched evidence. The default route opens `pt_201`; open the flagship explicitly at `http://127.0.0.1:5173/studio/dosetwin/cases/openkbp%3Apt_241` when its complete reference, archived prediction and saved comparison report are installed in the same database. `pt_241` and `pt_201` use different grids and source revisions; comparisons across those cases are rejected. The separate `start_local_openkbp_pt241.sh` launcher uses an isolated database and port and does not share accounts or saved reports with the default app. For Academy and Educator, create local student and educator accounts using the instructions below; the seeded learning accounts have passwords printed once and still need a lesson to be published and assigned.

This review checkout reuses the already-installed OpenKBP `pt_201`, a separately verified OpenKBP-Opt `pt_241` reference/prediction pair and full matched case, the complete Endoscapes sampled-frame release, FiSaV recordings and one Appendix300 MP4 excerpt through ignored local data paths; raw files stay outside Git. The default launcher opens `pt_201` and enables the `pt_241` case only when both the complete reference and archived prediction are installed. The default local database now also contains the verified `pt_241` archived prediction import and a saved comparison report. Those records are local-only; a fresh checkout needs the source files and import steps below.

```sh
./scripts/start_local_openkbp_pt241.sh
```

On the default app, select **OpenKBP pt_241** at <http://127.0.0.1:5173/studio/dosetwin/cases/current>, expand **Compare a real dose prediction**, choose `data/openkbp-opt/pt_241/prediction-set_1.csv`, and enter model revision `OpenKBP-Opt archived set_1`. Leave checkpoint SHA blank because the archive does not publish one. Enter source revision `16fbe0dbc64c94ed4b7e8378a090b47c6596bbd7`. The rights-basis record should say `Local research inspection authorized by the project owner; not a legal review.` Check the local-use confirmation and choose **Validate and add prediction**. Select the imported `prediction-set_1.csv` to see the matched reference, archived prediction, signed dose-difference slice, cumulative DVH and per-structure deltas; choose **Save comparison report** to retain the local report. The verified prediction SHA-256 is `d9fc8da169b2a7e12c1dd417f60b8364888ab28e233db19e87ee3ea93c40a583`.

This import compares the authentic archived set_1 output with its matching `pt_241` benchmark reference; it never mixes `pt_241` with `pt_201`, and it is not model inference. OpenKBP-Opt does not publish the checkpoint hash, and the archive's data-use terms are not established by its code license. The rights basis above records local project-owner authorization only; it is not a legal verification or permission to redistribute or publish the arrays. The separate `./scripts/start_local_openkbp_pt241.sh` profile remains available for isolated inspection on port 15176; its database is separate. Source files and saved reports are not copied when a Git branch is pushed; on another computer run `npm run doctor` and follow [`RUN_LOCAL.md`](../RUN_LOCAL.md).

The `pt_241` launcher is a separate local research profile. Student/educator accounts and learning records from `data/local.sqlite3` do not carry over to its isolated database; use the default launcher for Academy and Educator review.

## Create the local sign-in credentials

Provision one account for each profile you want to use. Run these commands from the project root. The script asks you to type and confirm each password without displaying it, requires at least 12 characters, stores only a salted password hash, and prints the resulting username (not the password):

```sh
apps/api/.venv/bin/python scripts/create_local_learning_user.py \
  --username educator --display-name "Local Educator" --role educator
apps/api/.venv/bin/python scripts/create_local_learning_user.py \
  --username learner --display-name "Local Student" --role student
apps/api/.venv/bin/python scripts/create_local_learning_user.py \
  --username reviewer --display-name "Local Research Reviewer" --role clinical_reviewer
```

The default launcher uses `data/local.sqlite3`, so these accounts will be available when you start it from this checkout. For a separate demo database, choose the database path **before provisioning and keep it the same when launching**:

```sh
export MEDFORGE_DB_PATH="$PWD/data/review-demo.sqlite3"
apps/api/.venv/bin/python scripts/create_local_learning_user.py \
  --username educator --display-name "Review Educator" --role educator
apps/api/.venv/bin/python scripts/create_local_learning_user.py \
  --username learner --display-name "Review Student" --role student
apps/api/.venv/bin/python scripts/create_local_learning_user.py \
  --username reviewer --display-name "Review Clinical Reviewer" --role clinical_reviewer
./scripts/start_local.sh
```

### HackCure Docker profile

The Docker rehearsal uses a separate, unencrypted SQLite database. It has **no default credentials** and does not share users or records with `data/local.sqlite3`. Start the stack first, then run these commands from the project root; each command prompts privately for a password of at least 12 characters:

```sh
docker compose -f docker-compose.yml -f docker-compose.hackcure.yml exec -it api \
  python /app/scripts/create_local_learning_user.py --username jury-educator \
  --display-name "Jury Research Educator" --role educator
docker compose -f docker-compose.yml -f docker-compose.hackcure.yml exec -it api \
  python /app/scripts/create_local_learning_user.py --username jury-reviewer \
  --display-name "Jury Research Reviewer" --role clinical_reviewer
# Optional Academy profile; an educator must still publish and assign a lesson.
docker compose -f docker-compose.yml -f docker-compose.hackcure.yml exec -it api \
  python /app/scripts/create_local_learning_user.py --username jury-student \
  --display-name "Jury Academy Student" --role student
```

The educator account can import the matching archived `pt_241` prediction and save its comparison report. The clinical-reviewer account can record and reopen the local research-review decision; it cannot import predictions or write comparison reports. This local reviewer role does not verify a medical credential. Keep the database under `data/hackcure-docker/` on a permission-restricted, encrypted host disk. Never place passwords in Git or screenshots. See [`HACKCURE_COMPLIANCE.md`](HACKCURE_COMPLIANCE.md) for the full walkthrough.

Visit the Academy, Educator, or DoseTwin review panel and enter the exact username plus the password you chose during provisioning. Sessions are local and revocable. Student, educator and Clinical Reviewer workflows should use separate accounts; entering another local account replaces the current browser session. Educators add provisioned students to a cohort before assigning a published lesson. A fresh database has no lessons, cohorts, assignments, or learner credentials until an educator/operator creates them.

Passwords are not recoverable from the database. To replace a forgotten local password, provision a new username or remove the local demo database and create the accounts again; deleting the database also deletes its local lessons and learning records. Never commit a database, password, session token, or temporary QA account. Do not reuse these local credentials for another service.

## What these profiles do not mean

- A Professional Studio page being open does not authenticate or authorize general research API requests. Keep the API bound to loopback; do not expose it to a LAN or public host.
- Signing in as an educator, student or Clinical Reviewer grants only the implemented local routes for that role. It does not establish production identity, hospital access, SSO, credential verification, or full API role-based access control.
- A local account is not a medical license or proof of clinical authority. The app is not approved for diagnosis, treatment decisions, clinical deployment, or public dataset hosting.
- Endoscapes in SurgiVision is a 1 fps sampled-still sequence with annotations only on the source-labeled keyframes. A separate 38.1-second continuous Appendix300 clip is available under CC BY 4.0; it shows appendectomy, not cholecystectomy, and is not supplied with instrument masks. DoseTwin has two separately selectable local source configurations: `pt_201` and a full `pt_241` case with its authentic OpenKBP-Opt set_1 prediction. They are different patients and grids. The `pt_241` prediction cannot be compared with `pt_201`; do not claim published checkpoint provenance because none was supplied.
