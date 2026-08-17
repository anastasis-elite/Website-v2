revoke all on public.health_integrations from anon, authenticated;
revoke all on public.health_samples from anon, authenticated;
revoke all on public.daily_health_metrics from anon, authenticated;

grant select, insert, update on public.health_integrations to authenticated;
grant select, insert, update on public.health_samples to authenticated;
grant select, insert, update on public.daily_health_metrics to authenticated;
