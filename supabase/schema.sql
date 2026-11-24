-- รันไฟล์นี้ทั้งหมดใน Supabase > SQL Editor ครั้งเดียว

create table if not exists guild_counters (
  guild_id    text primary key,
  last_number integer not null default 0
);

create table if not exists members (
  guild_id      text not null,
  user_id       text not null,
  member_number integer not null,
  username      text,
  joined_at     timestamptz not null default now(),
  left_at       timestamptz,
  primary key (guild_id, user_id),
  unique (guild_id, member_number)
);

-- ให้เลขลำดับสมาชิก: คนใหม่ได้เลขถัดไป, คนที่เคยอยู่แล้วกลับมาจะได้เลขเดิม
create or replace function assign_member_number(
  p_guild_id text,
  p_user_id  text,
  p_username text
) returns integer
language plpgsql
as $$
declare
  v_number integer;
begin
  select member_number into v_number
  from members
  where guild_id = p_guild_id and user_id = p_user_id;

  if found then
    update members
       set left_at = null, username = p_username
     where guild_id = p_guild_id and user_id = p_user_id;
    return v_number;
  end if;

  insert into guild_counters (guild_id, last_number)
  values (p_guild_id, 1)
  on conflict (guild_id)
  do update set last_number = guild_counters.last_number + 1
  returning last_number into v_number;

  insert into members (guild_id, user_id, member_number, username)
  values (p_guild_id, p_user_id, v_number, p_username);

  return v_number;
end;
$$;

-- ความปลอดภัย: เปิด RLS โดยไม่ตั้ง policy = คนทั่วไป (anon key) เข้าถึงข้อมูลไม่ได้
-- บอทใช้ service_role key ซึ่งข้าม RLS ได้ จึงทำงานปกติ
alter table guild_counters enable row level security;
alter table members        enable row level security;
