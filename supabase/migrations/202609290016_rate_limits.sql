-- Shared, atomic application limits. Subjects are HMAC digests, never emails/IPs.
create table public.request_buckets (
 bucket text primary key check(length(bucket)=64),
 expires_at timestamptz not null,
 hits integer not null check(hits>0)
);
alter table public.request_buckets enable row level security;
revoke all on public.request_buckets from public,anon,authenticated;
grant all on public.request_buckets to service_role;
create index request_buckets_expiry on public.request_buckets(expires_at);
create function public.consume_request_limit(bucket_key text,maximum integer,window_seconds integer)
returns integer language plpgsql security definer set search_path=public as $$
declare b request_buckets; begin
 if length(bucket_key)<>64 or maximum not between 1 and 1000 or window_seconds not between 1 and 86400 then raise exception 'Invalid limit'; end if;
 -- Expired entries contain no useful state. Bounded storage between requests.
 delete from request_buckets where expires_at<now()-interval '1 day';
 insert into request_buckets(bucket,expires_at,hits) values(bucket_key,now()+make_interval(secs=>window_seconds),1)
 on conflict(bucket) do update set
 hits=case when request_buckets.expires_at<=now() then 1 else least(request_buckets.hits+1,maximum+1) end,
 expires_at=case when request_buckets.expires_at<=now() then now()+make_interval(secs=>window_seconds) else request_buckets.expires_at end
 returning * into b;
 if b.hits>maximum then return greatest(1,ceil(extract(epoch from b.expires_at-now()))::integer); end if;
 return 0;
end $$;
revoke all on function public.consume_request_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_request_limit(text,integer,integer) to service_role;
