-- Sept 2024 P1 + P2 struggle tracker
-- Lives in the homework-hub project but is completely self-contained:
-- it does not touch students / progress / quests. The only shared thing is
-- public._mhq_admin_ok(), so the teacher page uses the admin password
-- Megan already has for the Blipwork hub.
--
-- Learner names are NEVER readable by anon. All three tables have RLS on
-- with no policies, so PostgREST cannot touch them. Everything goes through
-- the SECURITY DEFINER functions below, which each decide what may be seen.

-- ---------------------------------------------------------------- catalogue
create table if not exists public.exam_questions (
  paper_code text     not null,
  qnum       text     not null,
  q_main     text     not null,
  topic      text     not null,
  marks      smallint not null,
  seq        smallint not null,
  label_en   text     not null,
  label_af   text     not null,
  head_en    text     not null,
  head_af    text     not null,
  primary key (paper_code, qnum)
);

-- ------------------------------------------------------------------- flags
-- level: 0 = got it, 1 = shaky, 2 = no idea
create table if not exists public.exam_flags (
  paper_code   text        not null,
  qnum         text        not null,
  learner_key  text        not null,
  learner_name text        not null,
  level        smallint    not null check (level in (0, 1, 2)),
  updated_at   timestamptz not null default now(),
  primary key (paper_code, learner_key, qnum),
  foreign key (paper_code, qnum)
    references public.exam_questions (paper_code, qnum) on delete cascade
);

create index if not exists exam_flags_question_idx
  on public.exam_flags (paper_code, qnum);

-- ------------------------------------------------------------------- notes
create table if not exists public.exam_notes (
  paper_code   text        not null,
  learner_key  text        not null,
  learner_name text        not null,
  note         text        not null default '',
  updated_at   timestamptz not null default now(),
  primary key (paper_code, learner_key)
);

alter table public.exam_questions enable row level security;
alter table public.exam_flags     enable row level security;
alter table public.exam_notes     enable row level security;

revoke all on public.exam_questions from anon, authenticated;
revoke all on public.exam_flags     from anon, authenticated;
revoke all on public.exam_notes     from anon, authenticated;

-- --------------------------------------------------------------- name key
-- "  Anna-Marie  van Wyk " and "anna-marie van wyk" are the same learner.
create or replace function public.exam_name_key(p_name text)
returns text
language sql immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g'))
$$;

-- ------------------------------------------------------------ the question list
-- Public on purpose: it is just the printed paper's structure, no learner data.
create or replace function public.exam_question_list(p_paper text)
returns table (
  qnum text, q_main text, topic text, marks smallint, seq smallint,
  label_en text, label_af text, head_en text, head_af text
)
language sql stable security definer
set search_path = ''
as $$
  select q.qnum, q.q_main, q.topic, q.marks, q.seq,
         q.label_en, q.label_af, q.head_en, q.head_af
  from public.exam_questions q
  where q.paper_code = p_paper
  order by q.seq
$$;

-- ------------------------------------------------------------------ set a flag
create or replace function public.exam_flag_set(
  p_paper text, p_name text, p_qnum text, p_level int)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_name = '' or length(v_name) > 60 then
    raise exception 'Please use a name between 1 and 60 characters.';
  end if;
  if p_level is null or p_level not in (0, 1, 2) then
    raise exception 'Level must be 0, 1 or 2.';
  end if;
  if not exists (
    select 1 from public.exam_questions q
    where q.paper_code = p_paper and q.qnum = p_qnum
  ) then
    raise exception 'Unknown question.';
  end if;

  insert into public.exam_flags
    (paper_code, qnum, learner_key, learner_name, level, updated_at)
  values
    (p_paper, p_qnum, public.exam_name_key(v_name), v_name, p_level::smallint, now())
  on conflict (paper_code, learner_key, qnum) do update
    set level        = excluded.level,
        learner_name = excluded.learner_name,
        updated_at   = now();
end;
$$;

-- --------------------------------------------------- read back your own answers
create or replace function public.exam_flags_mine(p_paper text, p_name text)
returns table (qnum text, level smallint)
language sql stable security definer
set search_path = ''
as $$
  select f.qnum, f.level
  from public.exam_flags f
  where f.paper_code  = p_paper
    and f.learner_key = public.exam_name_key(coalesce(p_name, ''))
$$;

-- -------------------------------------------------------------------- the note
create or replace function public.exam_note_set(
  p_paper text, p_name text, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := left(coalesce(p_note, ''), 1000);
begin
  if v_name = '' or length(v_name) > 60 then
    raise exception 'Please use a name between 1 and 60 characters.';
  end if;

  insert into public.exam_notes
    (paper_code, learner_key, learner_name, note, updated_at)
  values
    (p_paper, public.exam_name_key(v_name), v_name, v_note, now())
  on conflict (paper_code, learner_key) do update
    set note         = excluded.note,
        learner_name = excluded.learner_name,
        updated_at   = now();
end;
$$;

create or replace function public.exam_note_mine(p_paper text, p_name text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select n.note from public.exam_notes n
     where n.paper_code  = p_paper
       and n.learner_key = public.exam_name_key(coalesce(p_name, ''))),
    '')
$$;

-- ------------------------------------------------------------- teacher: summary
-- One row per sub-question, with how many learners chose each level.
create or replace function public.exam_teacher_summary(p_password text)
returns table (
  paper_code text, qnum text, q_main text, topic text,
  marks smallint, seq smallint,
  label_en text, label_af text, head_en text, head_af text,
  n_got int, n_shaky int, n_stuck int
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public._mhq_admin_ok(p_password) then
    raise exception 'Wrong password.';
  end if;
  return query
    select q.paper_code, q.qnum, q.q_main, q.topic, q.marks, q.seq,
           q.label_en, q.label_af, q.head_en, q.head_af,
           count(*) filter (where f.level = 0)::int,
           count(*) filter (where f.level = 1)::int,
           count(*) filter (where f.level = 2)::int
    from public.exam_questions q
    left join public.exam_flags f
      on f.paper_code = q.paper_code and f.qnum = q.qnum
    group by q.paper_code, q.qnum, q.q_main, q.topic, q.marks, q.seq,
             q.label_en, q.label_af, q.head_en, q.head_af
    order by q.paper_code, q.seq;
end;
$$;

-- -------------------------------------------------------- teacher: who is where
create or replace function public.exam_teacher_learners(p_password text)
returns table (
  learner_name text, paper_code text,
  n_got int, n_shaky int, n_stuck int, answered int, last_seen timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public._mhq_admin_ok(p_password) then
    raise exception 'Wrong password.';
  end if;
  return query
    select max(f.learner_name), f.paper_code,
           count(*) filter (where f.level = 0)::int,
           count(*) filter (where f.level = 1)::int,
           count(*) filter (where f.level = 2)::int,
           count(*)::int,
           max(f.updated_at)
    from public.exam_flags f
    group by f.learner_key, f.paper_code
    order by max(f.learner_name), f.paper_code;
end;
$$;

-- --------------------------------------------------- teacher: every flag, raw
create or replace function public.exam_teacher_flags(p_password text)
returns table (learner_name text, paper_code text, qnum text, level smallint)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public._mhq_admin_ok(p_password) then
    raise exception 'Wrong password.';
  end if;
  return query
    select f.learner_name, f.paper_code, f.qnum, f.level
    from public.exam_flags f
    order by f.learner_name, f.paper_code, f.qnum;
end;
$$;

-- ------------------------------------------------------------ teacher: notes
create or replace function public.exam_teacher_notes(p_password text)
returns table (learner_name text, paper_code text, note text, updated_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public._mhq_admin_ok(p_password) then
    raise exception 'Wrong password.';
  end if;
  return query
    select n.learner_name, n.paper_code, n.note, n.updated_at
    from public.exam_notes n
    where btrim(n.note) <> ''
    order by n.updated_at desc;
end;
$$;

-- ------------------------------------------------------------------- grants
revoke all on function public.exam_flag_set(text, text, text, int)      from public;
revoke all on function public.exam_flags_mine(text, text)               from public;
revoke all on function public.exam_note_set(text, text, text)           from public;
revoke all on function public.exam_note_mine(text, text)                from public;
revoke all on function public.exam_question_list(text)                  from public;
revoke all on function public.exam_teacher_summary(text)                from public;
revoke all on function public.exam_teacher_learners(text)               from public;
revoke all on function public.exam_teacher_flags(text)                  from public;
revoke all on function public.exam_teacher_notes(text)                  from public;

grant execute on function public.exam_flag_set(text, text, text, int)   to anon, authenticated;
grant execute on function public.exam_flags_mine(text, text)            to anon, authenticated;
grant execute on function public.exam_note_set(text, text, text)        to anon, authenticated;
grant execute on function public.exam_note_mine(text, text)             to anon, authenticated;
grant execute on function public.exam_question_list(text)               to anon, authenticated;
grant execute on function public.exam_teacher_summary(text)             to anon, authenticated;
grant execute on function public.exam_teacher_learners(text)            to anon, authenticated;
grant execute on function public.exam_teacher_flags(text)               to anon, authenticated;
grant execute on function public.exam_teacher_notes(text)               to anon, authenticated;
