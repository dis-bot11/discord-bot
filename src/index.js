import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { Client, GatewayIntentBits, Partials, Events, AuditLogEvent } from 'discord.js';
import { config } from './config.js';
import { refreshChart } from './chart.js';
import { commands } from './commands/index.js';
import { handleBotJoinGuard, monitorBotActions } from './systems/antiNukeSystem.js';
import { BOARD_CONFIG_PATH, generateLeaderboardEmbed } from './commands/setupLeaderboard.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // ต้องเปิด Server Members Intent ใน Developer Portal
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // ต้องเปิด Message Content Intent ใน Developer Portal
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.GuildMember],
});

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

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ ออนไลน์แล้วในชื่อ ${c.user.tag} (แฟม ${config.familyName} [${config.familyTag}])`);

  let guild;
  try {
    guild = await c.guilds.fetch(config.guildId);
    // โหลดรายชื่อสมาชิกทั้งหมดเข้าแคช เพื่อให้เทียบ "ก่อน/หลัง" (ยศ ชื่อเล่น Timeout) ได้ครบทุกคน
    const members = await guild.members.fetch();
    console.log(`โหลดรายชื่อสมาชิกแล้ว ${members.size} คน`);
  } catch (error) {
    console.error('โหลดรายชื่อสมาชิกไม่สำเร็จ (ตรวจว่าเปิด Server Members Intent และ GUILD_ID ถูกต้อง):', error.message);
    return;
  }

  // ลงทะเบียน Slash Command (ต้องเชิญบอทด้วย scope applications.commands)
  try {
    await guild.commands.set(commands.map((command) => command.data.toJSON()));
    console.log(`✅ ลงทะเบียนคำสั่ง ${commands.length} คำสั่งแล้ว`);
  } catch (error) {
    console.error(
      '❌ ลงทะเบียนคำสั่งไม่สำเร็จ: ต้องเชิญบอทใหม่โดยติ๊ก scope "applications.commands" ด้วย (' + error.message + ')',
    );
  }

  await refreshChart(c);

  // ⏱️ ระบบตั้งเวลาอัปเดตบอร์ดออนเสียงอัตโนมัติทุกๆ 1 นาที (ดึงเวลาสด + ป้องกันเวลาหาย)
  setInterval(async () => {
    try {
      if (!fs.existsSync(BOARD_CONFIG_PATH)) return;
      const { channelId, messageId } = JSON.parse(fs.readFileSync(BOARD_CONFIG_PATH, 'utf8'));

      const channel = await c.channels.fetch(channelId).catch(() => null);
      if (!channel) return;

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) return;

      await message.edit({ embeds: [generateLeaderboardEmbed()] });
    } catch (err) {
      // จัดการกรณีข้อความถูกลบหรือห้องไม่พบ
    }
  }, 1 * 60 * 1000); // ทุก 1 นาที

  // ตรวจการตั้งค่า: บอกชัดๆ ว่าห้อง log ไหนใช้ได้ ไหนตั้งผิด/ขาดสิทธิ์
  try {
    const me = guild.members.me ?? (await guild.members.fetchMe());
    if (!me.permissions.has('ViewAuditLog')) {
      console.warn('⚠️ บอทไม่มีสิทธิ์ View Audit Log ช่อง "ผู้ดำเนินการ" ใน log จะขึ้นว่า ไม่ทราบ');
    }
    if (config.autoNickname && !me.permissions.has('ManageNicknames')) {
      console.warn('⚠️ เปิด AUTO_NICKNAME แต่บอทไม่มีสิทธิ์ Manage Nicknames');
    }

    // สิทธิ์ที่คำสั่งผู้ดูแลต้องใช้
    const needed = {
      BanMembers: '/แบน',
      KickMembers: '/ลงโทษ (เตะ)',
      ModerateMembers: '/ลงโทษ (Timeout)',
      ManageNicknames: '/จัดชื่อแฟม และ AUTO_NICKNAME',
    };
    if (config.autoRoleId) needed.ManageRoles = 'ให้ยศอัตโนมัติ';
    for (const [perm, usedFor] of Object.entries(needed)) {
      if (!me.permissions.has(perm)) console.warn(`⚠️ บอทไม่มีสิทธิ์ ${perm} (ใช้กับ ${usedFor})`);
    }

    // ยศผู้ดูแล / ยศในผัง / ยศอัตโนมัติ ต้องมีอยู่จริงในเซิร์ฟเวอร์
    for (const id of config.adminRoleIds) {
      const role = guild.roles.cache.get(id);
      console.log(role ? `✅ ยศผู้ดูแล → ${role.name} (${role.members.size} คน)` : `❌ ยศผู้ดูแลไอดี ${id} ไม่พบในเซิร์ฟเวอร์นี้`);
    }
    for (const id of config.chartRoleIds) {
      if (!guild.roles.cache.has(id)) console.warn(`❌ ยศในผังแฟมไอดี ${id} ไม่พบในเซิร์ฟเวอร์นี้ (ตรวจ CHART_ROLE_IDS)`);
    }
    if (config.autoRoleId) {
      const role = guild.roles.cache.get(config.autoRoleId);
      if (!role) {
        console.warn(`❌ ยศอัตโนมัติไอดี ${config.autoRoleId} ไม่พบในเซิร์ฟเวอร์นี้ (ตรวจ AUTO_ROLE_ID)`);
      } else if (role.position >= me.roles.highest.position) {
        console.warn(`❌ ยศอัตโนมัติ "${role.name}" อยู่สูงกว่าหรือเท่ากับยศบอท บอทจะให้ยศนี้ไม่ได้ (ลากยศบอทให้สูงกว่า)`);
      } else {
        console.log(`✅ ยศอัตโนมัติสำหรับสมาชิกใหม่ → ${role.name}`);
      }
    }

    // ห้อง: required = ไม่ตั้งแล้วฟีเจอร์นั้นไม่ทำงาน, ไม่ใช่ required = ไม่ตั้งจะโพสต์ในห้องที่พิมพ์คำสั่ง
    const labels = {
      welcome: ['ต้อนรับ', true],
      member: ['log-สมาชิก', true],
      message: ['log-ข้อความ', true],
      voice: ['log-เสียง', true],
      mod: ['log-แอดมิน', true],
      announce: ['ประกาศ', false],
      notice: ['แจ้งก่อน', false],
      punish: ['ประกาศโทษ', false],
    };

    for (const [key, [label, required]] of Object.entries(labels)) {
      const id = config.channels[key];
      if (!id) {
        console.warn(
          required
            ? `⚠️ ห้อง ${label}: ยังไม่ได้ตั้งค่า (ตัวแปรว่าง) จะไม่ส่ง log ประเภทนี้`
            : `ℹ️ ห้อง ${label}: ไม่ได้ตั้งค่า จะโพสต์ในห้องที่พิมพ์คำสั่งแทน`,
        );
        continue;
      }
      try {
        const channel = await c.channels.fetch(id);
        if (channel.guildId !== config.guildId) {
          console.warn(`❌ ห้อง ${label}: ไอดี ${id} เป็นห้องของเซิร์ฟเวอร์อื่น`);
          continue;
        }
        const missing = ['ViewChannel', 'SendMessages', 'EmbedLinks'].filter(
          (perm) => !channel.permissionsFor(me)?.has(perm),
        );
        if (missing.length > 0) {
          console.warn(`❌ ห้อง ${label} (#${channel.name}): บอทขาดสิทธิ์ ${missing.join(', ')}`);
        } else {
          console.log(`✅ ห้อง ${label} → #${channel.name}`);
        }
      } catch (error) {
        console.warn(`❌ ห้อง ${label}: หาห้องไอดี ${id} ไม่เจอ หรือบอทเข้าไม่ถึง (${error.message})`);
      }
    }
  } catch (error) {
    console.error('ตรวจการตั้งค่าไม่สำเร็จ:', error.message);
  }
});

// กันบอทล่มทั้งตัวจาก error ที่หลุดมา
process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));

await client.login(config.token);