# Project status — updated 2026-08-25

> **RETIRED 2026-10-01, kept as a skeleton.** Retired together with Sept 2024 Vlaggies (this site only redirected there).

- Website taken down (GitHub Pages turned off) and the GitHub repo archived: read-only,
  code kept. To undo: repo Settings, Unarchive, then turn Pages back on.
- Local folder moved to `Claude Code Projects\_archive\`.
- Its tables `exam_questions` / `exam_flags` / `exam_notes` sit in the LIVE homework-hub (Blipwork)
  Supabase project. Left alone on purpose: tiny, harmless, and that project stays awake.
- Keep this repo: `questions.json` is the verified source Sept 2024 Vlaggies generates from.


## Where we are

The site is **live and finished**: https://megzieberr.github.io/sept2024-check/
(teacher view at `/teacher.html`, password = the Blipwork hub admin password).

Grade 12s open it after writing the September 2024 DBE P1 and P2 over the
weekend of 29–30 August, and flag which questions they struggled with. Every
question starts on **Snap dit**; they only change the ones that hurt. Megan's
view leads with a by-topic table, worst first.

Backend is the existing `homework-hub` Supabase project
(`pjpwhalcifywjrwtjknd`) — tables `exam_questions` / `exam_flags` /
`exam_notes`, all reached only through the `exam_*` functions. Deliberately
not a new project, to keep the daily keepalive list at 10.

Both colour memos are also done — see **Files generated** below.

## Decisions

- **2026-08-25** — Three levels, not a tick-box. A tick only says "struggled";
  three levels say what to reteach versus what to just remind.
- **2026-08-25** — The middle level is the word **"eh"** in both languages.
  "Wankel" was rejected — nobody says it.
- **2026-08-25** — Teacher view groups **by topic, not by question number**.
  The Monday decision is "9 of 14 are red on Euclidean geometry".
- **2026-08-25** — Everything **pre-selects as "Snap dit"**; 101 taps was too
  tedious. Consequence: nothing writes until they engage, so the first change
  to a paper (or the "Klaar" button) commits the WHOLE paper at once via
  `exam_flags_set_many`, untouched ones as "got it". Do not simplify that
  away — without it, one learner flagging a question reads as 100% trouble
  while the other thirteen have no rows at all.
- **2026-08-25** — No memo gate. She hands out paper + memo; the site is
  purely for flagging afterwards.
- **2026-08-25** — Memos are **separate documents per language**, not
  bilingual side-by-side.
- **2026-08-25** — Learner names live in Supabase only, never in the repo.
  RLS is on with no policies so the public key gets 401 on all three tables.
  The Supabase advisories that flag this are the design, not a bug.

## Pending on Megan

- Nothing. (2026-08-31 sweep, her word: all three KILLED — the admin sign-in check, the four memo prints, and the Q12 English wording check. ⚠ The Q12 English stem stays a reconstruction from the Afrikaans; nobody is going to re-check it.)

## Next up

Nothing scheduled. The site needs no further work before the weekend.

Two open judgement calls, both hers and neither blocking:

- The amber ★ Level 4 lists are the memos' own reading — 12 sub-parts /
  46 marks in P1, 10 sub-parts / 42 marks in P2. DBE published no grid for
  this paper and both covers say so. To change one, swap `\vk` ↔ `\vkster`
  on that part.
- P2's 6.4 is given as `120° < x < 180°` to match the official guideline,
  with a note that `120° < x ≤ 180°` is the same stretch and also accepted.

After the weekend, the useful follow-up is reading the teacher page and
deciding what to reteach in the last week.

## Files generated this session

Site (this repo, all committed and pushed, `a66c7fc`):
`C:\Users\megzi\Desktop\Claude Code Projects\sept2024-check\`

Memos — **not** a git repo, they live beside the papers:

- `C:\Users\megzi\Desktop\Eksamen Vraestelle\Gr12 DBE Vraestelle\Gr12 Sept Vraestelle\Sept 2024\Kleurmemo V1\`
  — `Sept2024-V1-Kleurmemo-ENG.pdf` and `-AFR.pdf`, 32 pages each, plus `.tex`,
  `verify_ticks.py`, `verify_pair.py`, `fig\`.
- `C:\Users\megzi\Desktop\Eksamen Vraestelle\Gr12 DBE Vraestelle\Gr12 Sept Vraestelle\Sept 2024\Kleurmemo V2\`
  — `Sept2024-V2-Kleurmemo-ENG.pdf` and `-AFR.pdf`, 30 pages each, same
  supporting files.

## Errors found in the official DBE material (all verified independently)

Worth telling the learners, because they self-mark against downloaded memos.

| Where | What |
|---|---|
| P1 memo **7.2** | Gives R260 171,34 — forgets to carry the first block forward 60 months. Correct: **R340 825,14** (the province issued an errata). |
| P1 memo **8.1** | Expands `(x+h)²` as `x² + 2xh − h²` and carries the minus down. Answer `2x` survives only because `h → 0`. Not previously flagged anywhere. |
| P2 memo **5.4.2** | Second solution family given as `x = 120° − k·360°`; it is `x = 150° + k·360°`. 120° is not a root. Solutions in [0°;360°): **10°, 130°, 150°, 250°**. This one costs marks on self-marking. |
| P2 memo 5.4.1 | A dropped `2`; right answer, wrong printed line. |
| P2 memo 6.5 | A dropped minus mid-line; right answer. |
| P1 paper **9.2** | The two bullets contradict each other — `t(−3)=t(3)=t(0)=0` forces turning points at ±√3, not ±1,5. Does not affect marking. |
| P2 paper **Q3** | **"O" is not the origin.** AB has inclination 45°, so its x-intercept is (−1;0). The given area of ΔOBF = 12 only works there; assuming the origin gives 10 and 3.7 collapses. |

## Traps for the next session

- `questions.json` is the single source of truth. After editing it run
  `python build.py` (it re-checks both papers total 150) **and** re-run
  `supabase/seed-questions.sql`. `js/questions.js` is GENERATED.
- ⚠️ **The PDF text layer silently drops primes, inequality signs and whole
  qualifying words.** It bit this project three times — 5.5, 6.2.3 and 1.1.5
  were all wrong until the lines were rendered at 400 dpi and looked at.
  Never trust `get_text()` for an operator or a qualifier.
- Screenshots in the Browser pane time out on this laptop. Verify layout by
  reading the DOM.
- The teacher password is the Blipwork hub admin password; the migration
  deliberately reuses `_mhq_admin_ok`. There is no separate one.
