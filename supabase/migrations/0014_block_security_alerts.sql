-- ==============================================================================
-- Migration: 0014_block_security_alerts.sql
-- IITB SSO "New LDAP login" alerts (device, IP, location) are personal: never publish.
-- ==============================================================================
create or replace function public.skip_legacy_item_push() returns trigger language plpgsql as $$
begin
  if new.source = 'mail' then return null; end if;
  if new.source = 'ingest-mail' then
    if coalesce(new.sender, '') ~* '(supabase|signin@campusdaily|@campusdaily\.nexuspulsetech\.com|accounts\.google|no-?reply@google|noreply-cc@iitb)' then return null; end if;
    if coalesce(new.subject, '') ~* '(sign-?in (link|code)|log-?in code|verification code|verify your|confirm your (email|account)|one-?time (code|password)|\motp\M|password reset|reset your password|campus daily code|magic link|new (ldap )?log-?in|log-?in (alert|notification)|new sign-?in|sign-?in alert|security alert)' then return null; end if;
    if coalesce(new.sender, '') !~* 'iitb\.ac\.in' then return null; end if;
  end if;
  return new;
end $$;

delete from public.user_items where item_id in (select id from public.items where sender ~* 'noreply-cc@iitb' or subject ~* 'new ldap login');
delete from public.items where sender ~* 'noreply-cc@iitb' or subject ~* 'new ldap login';
