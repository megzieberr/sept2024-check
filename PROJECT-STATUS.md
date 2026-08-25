# PROJECT-STATUS — Sept 2024 check-in

**Last session: 2026-08-25**

## Where it is

The site is **built and live**. Read `README.md` first — it explains the
design decisions.

- Learners: https://megzieberr.github.io/sept2024-check/
- Megan: https://megzieberr.github.io/sept2024-check/teacher.html
- Backend: `homework-hub` Supabase project (`pjpwhalcifywjrwtjknd`),
  tables `exam_questions` / `exam_flags` / `exam_notes`.

## What was verified on 2026-08-25

Not "should work" — these were actually run in the browser against live Supabase:

- Both papers parse to **exactly 150 marks** (51 + 50 sub-questions), checked
  against the mark totals printed in the papers *and* the topic splits in
  `DBE-PAPER-BANK.md`.
- Tapping a level writes to Supabase; 15 taps produced 15 rows with the right
  levels. Changing an answer **updates** the row, it does not duplicate.
- Wiping localStorage and reloading brought all flags **and** the typed note
  back from the server — so phone-to-laptop works.
- Offline: taps still register, the badge says so, the queue holds them, and
  they sync when the connection returns. Verified end to end.
- Security: the anon key gets **401** on all three tables. All four
  `exam_teacher_*` functions refuse a wrong password.
- Layout: no horizontal overflow at 375px; tap targets 44×103px.
- Teacher page: topic table sorts worst-first and the percentages are right
  (Finance 0 got / 1 shaky / 3 stuck → 88%).

Test data was deleted afterwards — flags and notes are both at 0 rows.

## Still to do

- [ ] **P1 memo, English + Afrikaans** (separate documents, her colour house
      style, tick-per-mark). This is the big remaining piece. The P1 errata
      correction for 7.2 must go in: correct answer **R340 825,14**.
- [ ] **P2 memo**, same again, early the following week.
- [ ] Megan to send the link to the class.

## Things not to get wrong next time

- `questions.json` is the single source. After editing it, run
  `python build.py` (it re-checks the 150 totals) **and** re-run
  `supabase/seed-questions.sql`. Editing `js/questions.js` by hand will be
  silently overwritten.
- The teacher password is the Blipwork hub admin password — there is no
  separate one, and the migration deliberately reuses `_mhq_admin_ok`.
- The Supabase security advisories flag `rls_enabled_no_policy` and
  `anon_security_definer_function_executable` for these objects. **That is the
  design, not a bug** — it is the same pattern as the 44 functions already in
  the hub. Do not "fix" it by adding anon policies.
- Screenshots in the Browser pane time out on this laptop. Verify layout by
  reading the DOM instead.
