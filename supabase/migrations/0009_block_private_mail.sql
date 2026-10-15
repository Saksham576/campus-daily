-- ==============================================================================
-- Migration: 0009_block_private_mail.sql
-- The ingest Gmail receives a whole forwarded IITB inbox. Never store sign-in /
-- verification emails (they contain login codes) or non-IITB mail as notices.
-- (Also enforced in the app: privateMailReason in src/lib/ingest.ts.)
-- ==============================================================================
create or replace function public.skip_legacy_item_push() returns trigger language plpgsql as $$
begin
  if new.source = 'mail' then return null; end if;
  if new.source = 'ingest-mail' then
    if coalesce(new.sender, '') ~* '(supabase|signin@campusdaily|@campusdaily\.nexuspulsetech\.com|accounts\.google|no-?reply@google)' then return null; end if;
    if coalesce(new.subject, '') ~* '(sign-?in (link|code)|log-?in code|verification code|verify your|confirm your (email|account)|one-?time (code|password)|\motp\M|password reset|reset your password|campus daily code|magic link)' then return null; end if;
    if coalesce(new.sender, '') !~* 'iitb\.ac\.in' then return null; end if;
  end if;
  return new;
end $$;
