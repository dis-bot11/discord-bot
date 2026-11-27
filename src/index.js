import http from 'node:http';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { Client, GatewayIntentBits, Partials, Events, AuditLogEvent } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import { config } from './config.js';
import { refreshChart } from './chart.js';
import { commands } from './commands/index.js';
import { handleBotJoinGuard, monitorBotActions } from './systems/antiNukeSystem.js';
import { BOARD_CONFIG_PATH, generateLeaderboardEmbed } from './commands/setupLeaderboard.js';
import { supabase, addVoiceMinutes } from './utils/supabase.js';

// เปิดพอร์ต HTTP ให้ Render ตรวจจับสถานะ Live และรับสัญญาณปลุกจาก UptimeRobot
const port = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Rasia Bot is online!');
  })
  .listen(port, '0.0.0.0', () => {
    console.log(`🌐 HTTP Server listening on port ${port}`);
  });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.GuildMember],
});

// 🔊 ฟังก์ชันสั่งให้บอทเข้าห้องเสียงค้างไว้ 24 ชม. และดึงกลับอัตโนมัติหากหลุด
async function connectToVoiceChannel(c) {
  const TARGET_VOICE_CHANNEL_ID = '1459494663718174858';

  try {
    const channel = await c.channels.fetch(TARGET_VOICE_CHANNEL_ID);
    if (!channel || !channel.isVoiceBased()) {
      console.warn(`❌ ไม่พบห้องเสียงไอดี ${TARGET_VOICE_CHANNEL_ID} หรือไอดีไม่ใช่ห้องเสียง`);
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        connection.destroy();
        setTimeout(() => connectToVoiceChannel(c), 5_000);
      }
    });

    console.log(`🔊 บอทเข้าห้องเสียง #${channel.name} ค้างไว้เรียบร้อยแล้ว!`);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการเข้าห้องเสียง:', error.message);
  }
}

// โหลดทุกไฟล์ใน src/events อัตโนมัติ
const eventsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'events');
for (const file of readdirSync(eventsDir).filter((f) => f.endsWith('.js'))) {
  const { default: event } = await import(pathToFileURL(path.join(eventsDir, file)).href);
  client.on(event.name, async (...args) => {
    try {
      await event.execute(...args, client);
    } catch (error) {
      console.error(`[event:${event.name}] error:`, error);
    }
  });
}

// 🛡️ ระบบป้องกันบอท (Anti-Nuke & Bot Guard)
client.on(Events.GuildMemberAdd, async (member) => {
  await handleBotJoinGuard(member);
});

client.on(Events.ChannelDelete, async (channel) => {
  if (channel.guild) {
    await monitorBotActions(channel.guild, AuditLogEvent.ChannelDelete);
  }
});

client.on(Events.GuildRoleDelete, async (role) => {
  if (role.guild) {
    await monitorBotActions(role.guild, AuditLogEvent.RoleDelete);
  }
});

// ⚙️ ตั้งค่าระดับยศตามชั่วโมงสะสม
const RANK_TIERS = [
  { hours: 50, roleId: '1573540691164926042' },
  { hours: 100, roleId: '1573540865350311956' },
  { hours: 250, roleId: '1573541072095682591' },
  { hours: 500, roleId: '1573553344738234498' },
];

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ ออนไลน์แล้วในชื่อ ${c.user.tag} (แฟม ${config.familyName} [${config.familyTag}])`);

  await connectToVoiceChannel(c);

  let guild;
  try {
    guild = await c.guilds.fetch(config.guildId);
    const members = await guild.members.fetch();
    console.log(`โหลดรายชื่อสมาชิกแล้ว ${members.size} คน`);
  } catch (error) {
    console.error('โหลดรายชื่อสมาชิกไม่สำเร็จ:', error.message);
    return;
  }

  try {
    await guild.commands.set(commands.map((command) => command.data.toJSON()));
    console.log(`✅ ลงทะเบียนคำสั่ง ${commands.length} คำสั่งแล้ว`);
  } catch (error) {
    console.error('❌ ลงทะเบียนคำสั่งไม่สำเร็จ:', error.message);
  }

  await refreshChart(c);

  // ⏱️ [ActivityRank] ระบบกวาดเช็กคนออนห้องเสียง + บวกเวลาสด 1 นาที + แจกยศ + อัปเดตบอร์ด ทุกๆ 1 นาที
  setInterval(async () => {
    try {
      const afkChannelId = guild.afkChannelId;

      for (const [, voiceState] of guild.voiceStates.cache) {
        const member = voiceState.member;
        const channelId = voiceState.channelId;

        // ข้ามบอท, ข้ามคนที่ไม่ได้อยู่ห้องเสียง, และตัดห้อง AFK ออกเด็ดขาด 100%
        if (!member || member.user.bot || !channelId || channelId === afkChannelId) continue;

        // บวกเวลาเพิ่ม 1 นาทีลง Supabase (ตารางปัจจุบัน) ทันที
        await addVoiceMinutes(member.id, 1);

        // ✅ ดึงเวลาสะสมรวมจากทั้ง 3 ตาราง (old + historical + current) มาเช็กแจกยศ
        const [oldRes, histRes, currRes] = await Promise.all([
          supabase.from('voice_times_old').select('minutes').eq('user_id', member.id).maybeSingle(),
          supabase.from('voice_times_historical').select('minutes').eq('user_id', member.id).maybeSingle(),
          supabase.from('voice_times').select('minutes').eq('user_id', member.id).maybeSingle()
        ]);

        const totalMinutes = (oldRes.data?.minutes || 0) + (histRes.data?.minutes || 0) + (currRes.data?.minutes || 0);
        const totalHours = Math.floor(totalMinutes / 60);

        for (const tier of RANK_TIERS) {
          if (totalHours >= tier.hours && tier.roleId && !tier.roleId.includes('ใส่_ROLE_ID')) {
            if (!member.roles.cache.has(tier.roleId)) {
              await member.roles.add(tier.roleId, `ออนห้องเสียงสะสมครบ ${tier.hours} ชั่วโมง`).catch(() => {});
              console.log(`[VoiceReward] แจกยศ ${tier.hours} ชม. ให้ ${member.user.tag} สำเร็จ`);
            }
          }
        }
      }

      // อัปเดตหน้าบอร์ด Leaderboard ใน Discord
      if (!fs.existsSync(BOARD_CONFIG_PATH)) return;
      const { channelId, messageId } = JSON.parse(fs.readFileSync(BOARD_CONFIG_PATH, 'utf8'));

      const channel = await c.channels.fetch(channelId).catch(() => null);
      if (!channel) return;

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) return;

      const embed = await generateLeaderboardEmbed();
      await message.edit({ embeds: [embed] });
    } catch (err) {
      console.error('[ActivityRank Tick Error]:', err);
    }
  }, 1 * 60 * 1000); // ทุก 1 นาทีเป๊ะ

  // ตรวจการตั้งค่าและสิทธิ์ต่างๆ
  try {
    const me = guild.members.me ?? (await guild.members.fetchMe());
    if (!me.permissions.has('ViewAuditLog')) {
      console.warn('⚠️ บอทไม่มีสิทธิ์ View Audit Log');
    }
  } catch (error) {
    console.error('ตรวจการตั้งค่าไม่สำเร็จ:', error.message);
  }
});

process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));

await client.login(config.token);