# Sept 2024 check-in

> **RETIRED 2026-10-01, kept as a skeleton.** Retired together with Sept 2024 Vlaggies (this site only redirected there).

- Website taken down (GitHub Pages turned off) and the GitHub repo archived: read-only,
  code kept. To undo: repo Settings, Unarchive, then turn Pages back on.
- Local folder moved to `Claude Code Projects\_archive\`.
- Its tables `exam_questions` / `exam_flags` / `exam_notes` sit in the LIVE homework-hub (Blipwork)
  Supabase project. Left alone on purpose: tiny, harmless, and that project stays awake.
- Keep this repo: `questions.json` is the verified source Sept 2024 Vlaggies generates from.


A one-page site where Grade 12s mark how each question of the **September 2024
DBE P1 and P2** felt, so Megan knows what to reteach in the last week before
the exam.

- **Learners:** https://megzieberr.github.io/sept2024-check/
- **Megan:** https://megzieberr.github.io/sept2024-check/teacher.html

## How it works

Every sub-question of both papers is listed — 51 in Paper 1, 50 in Paper 2,
150 marks each. Each one offers **Got it / eh / No idea**. Three levels, not
a tick-box: a tick only says "struggled", three levels say what to reteach
versus what to just remind.

**Everything starts on "Got it".** The learner only changes the ones they
struggled with, so a paper is a handful of taps rather than 51.

Because of that default, nothing is written until they actually engage. The
first change to a paper — or pressing **Done with this paper** — commits the
whole paper in one request, with the untouched questions going in as "got
it". That keeps the teacher percentages honest: a question flagged by one
learner should not read as 100% trouble just because the other thirteen never
wrote a row. The Done button also covers the learner who struggled with
nothing, and is the signal that they actually did the paper.

After that, changing an answer saves on the tap. If the phone is offline the
taps merge into one queued payload per paper and go out on the next tap, on
reload, or when the browser comes back online. Answers also come back from
the server, so a learner can start on a phone and finish on a laptop.

Learners type their name once. Names are matched case- and space-insensitively,
so "anna  marie" and "Anna Marie" are the same person.

The page is bilingual — the button top right flips between Afrikaans and
English, and remembers the choice.

## The teacher page

Password is the **same admin password as the Blipwork hub** (it calls the
existing `public._mhq_admin_ok`).

It leads with a **by-topic** table, worst first, because that is the decision
you actually make on Monday — "9 of 14 are red on Euclidean geometry", not
"9.2 was bad". The "trouble" number is 0 when everyone is fine and 100 when
everyone is stuck; shaky counts half as much as stuck. Below that is every
question, then who has filled it in, then anything they typed.

## Privacy

The repo is public, so nothing identifying lives in it. Learner names are in
Supabase only.

All three tables have RLS on with **no policies**, so the public anon key
cannot read them at all — verified, it returns 401. Everything goes through
the `exam_*` functions in `supabase/migration.sql`, which each decide what may
be seen. The four `exam_teacher_*` functions refuse without the password.

**One thing to know:** `exam_flags_mine` takes only a name, so someone who
knew a learner used this site *and* guessed their exact name could see which
questions that learner flagged. Nothing else — no marks, no other learner.
That was a deliberate trade for a two-week tool with no logins. If it ever
matters, add a 4-digit PIN to the name gate.

## Files

| | |
|---|---|
| `questions.json` | **The one source of truth** for both papers. |
| `build.py` | Regenerates `js/questions.js` and `supabase/seed-questions.sql`. It also checks every question's parts add up and that each paper totals 150 — run it after any edit. |
| `js/app.js` | Learner page. |
| `js/teacher.js` | Teacher page. |
| `supabase/migration.sql` | Tables and functions. Already applied. |

The question list was read straight out of `Sept 2024 V1.pdf` and
`Sept 2024 V2.pdf` and reconciled against the mark totals printed in the
papers, and against the topic splits in `DBE-PAPER-BANK.md`. Both papers add
to exactly 150.

To change wording, edit `questions.json`, run `python build.py`, then re-run
`supabase/seed-questions.sql`.

## Note on the P1 errata

`Sept 2024 V1 ERRATA.pdf` is a correction to the **marking guideline** for
7.2, not to the question paper — the official memo's answer was wrong. The
correct answer is **R340 825,14**. The question paper the learners write is
unaffected. This matters for the memo, not for this site.
