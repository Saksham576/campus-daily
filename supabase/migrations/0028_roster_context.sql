-- Class-list rows keep what a bare line loses: the document title / date / time, the section it sits
-- under (room, row, batch) and the column names. Existing roster documents are read again.
alter table public.personal_rows add column if not exists context text;
alter table public.personal_rows add column if not exists columns text;
update public.documents set status = 'pending', tries = 0, error = null where is_roster;
