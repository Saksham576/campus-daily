-- The owner's own Ask conversations are kept (question, answer, outcome) so wrong answers can be debugged.
-- Everyone else's rows stay as before: who asked and when, no text.
alter table public.ask_log add column if not exists question text;
alter table public.ask_log add column if not exists answer text;
alter table public.ask_log add column if not exists ok boolean;
