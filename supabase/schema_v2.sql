-- เฟส 2-3: ประวัติโทษ, การแจ้งก่อน, ผังแฟมที่อัปเดตเอง
-- รันไฟล์นี้ทั้งหมดใน Supabase > SQL Editor หลังจากรัน schema.sql แล้ว (รันซ้ำได้ ไม่ทำให้ข้อมูลหาย)

create table if not exists punishments (
  id               bigint generated always as identity primary key,
  guild_id         text not null,
  user_id          text not null,
  user_tag         text,
  type             text not null,          -- warn | timeout | ban | unban
  reason           text,
  duration_minutes integer,
  moderator_id     text not null,
  moderator_tag    text,
  created_at       timestamptz not null default now()
);
create index if not exists punishments_user_idx
  on punishments (guild_id, user_id, created_at desc);

create table if not exists notices (
  id         bigint generated always as identity primary key,
  guild_id   text not null,
  user_id    text not null,
  user_tag   text,
  from_text  text not null,
  to_text    text,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index if not exists notices_user_idx
  on notices (guild_id, user_id, created_at desc);

create table if not exists chart_messages (
  guild_id   text primary key,
  channel_id text not null,
  message_id text not null
);

-- เปิด RLS โดยไม่ตั้ง policy = คนทั่วไป (anon key) เข้าถึงไม่ได้ บอทใช้ secret key จึงทำงานได้ปกติ
alter table punishments    enable row level security;
alter table notices        enable row level security;
alter table chart_messages enable row level security;
