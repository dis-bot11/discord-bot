import 'dotenv/config';

function env(key) {
  let value = (process.env[key] ?? '').trim();
  if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1).trim();
  return value;
}

function envList(key, fallback = []) {
  const raw = env(key);
  if (!raw) return fallback;
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeSupabaseUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    console.error('SUPABASE_URL ไม่ใช่ลิงก์ที่ถูกต้อง');
    process.exit(1);
  }
  return url.origin;
}

const required = ['DISCORD_TOKEN', 'GUILD_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missing = required.filter((key) => !env(key));

if (missing.length > 0) {
  console.error(`ขาดค่าที่จำเป็นใน Environment Variables: ${missing.join(', ')}`);
  process.exit(1);
}

export const config = {
  token: env('DISCORD_TOKEN'),
  guildId: env('GUILD_ID'),
  familyName: env('FAMILY_NAME') || 'สุภาพสตรี',
  familyTag: env('FAMILY_TAG') || 'สตรี',
  autoNickname: env('AUTO_NICKNAME') === 'true',
  adminRoleIds: new Set(
    envList('ADMIN_ROLE_IDS', [
      '1459481860626190568',
      '1573183445629149207',
      '1572971878270902483',
      '1459478063455797361',
    ]),
  ),
  chartRoleIds: envList('CHART_ROLE_IDS', [
    '1459481860626190568',
    '1554109946973528166',
    '1573183445629149207',
    '1572971878270902483',
    '1459478063455797361',
    '1572978705712681012',
  ]),
  autoRoleId: env('AUTO_ROLE_ID') || null,
  channels: {
    announce: env('ANNOUNCE_CHANNEL_ID') || null,
    notice: env('NOTICE_CHANNEL_ID') || null,
    punish: env('PUNISH_CHANNEL_ID') || null,
    welcome: env('WELCOME_CHANNEL_ID') || null,
    member: env('LOG_MEMBER_CHANNEL_ID') || null,
    message: env('LOG_MESSAGE_CHANNEL_ID') || null,
    voice: env('LOG_VOICE_CHANNEL_ID') || null,
    mod: env('LOG_MOD_CHANNEL_ID') || null,
  },
  supabaseUrl: normalizeSupabaseUrl(env('SUPABASE_URL')),
  supabaseKey: env('SUPABASE_SERVICE_KEY'),
};

export const logChannelIds = new Set(
  [config.channels.member, config.channels.message, config.channels.voice, config.channels.mod].filter(Boolean),
);