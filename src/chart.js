import { EmbedBuilder } from 'discord.js';
import { config } from './config.js';
import { getChartMessage } from './db.js';
import { COLORS } from './logger.js';

const ICONS = ['👑', '🌟', '🔱', '🛡️', '💠'];

/** สร้าง embed ผังแฟมจากยศจริงใน CHART_ROLE_IDS (คนที่มีหลายยศจะแสดงที่ยศสูงสุดในผังเท่านั้น) */
export function buildChartEmbed(guild) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`🌸 ผังโครงสร้างแฟม ${config.familyName} [${config.familyTag}]`);

  const seen = new Set();
  let total = 0;

  config.chartRoleIds.forEach((roleId, index) => {
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      embed.addFields({ name: '⚠️ ไม่พบยศ', value: `ไอดี ${roleId} (ตรวจค่า CHART_ROLE_IDS)` });
      return;
    }

    const members = role.members
      .filter((m) => !m.user.bot && !seen.has(m.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
    members.forEach((m) => seen.add(m.id));
    total += members.size;

    let value = '';
    let shown = 0;
    for (const member of members.values()) {
      const line = `<@${member.id}>\n`;
      if ((value + line).length > 950) break;
      value += line;
      shown += 1;
    }
    if (shown < members.size) value += `…และอีก ${members.size - shown} คน`;

    const icon = ICONS[index] ?? '👥';
    embed.addFields({
      name: `${icon} ${role.name} (${members.size})`.slice(0, 250),
      value: value.trim() || '— ว่าง —',
    });
  });

  return embed.setFooter({ text: `รวมในผังนี้ ${total} คน • อัปเดตล่าสุด` }).setTimestamp();
}

/** แก้ข้อความผังที่ปักไว้ (ถ้ามี) ให้ตรงกับยศปัจจุบัน */
export async function refreshChart(client) {
  try {
    const saved = await getChartMessage(config.guildId);
    if (!saved) return;
    const channel = await client.channels.fetch(saved.channel_id);
    const message = await channel.messages.fetch(saved.message_id);
    const guild = await client.guilds.fetch(config.guildId);
    await message.edit({ embeds: [buildChartEmbed(guild)] });
  } catch (error) {
    console.error('[chart] อัปเดตผังไม่สำเร็จ:', error.message);
  }
}

let timer = null;
/** สั่งอัปเดตผังแบบหน่วง 10 วินาที (รวมหลายการเปลี่ยนยศติดกันให้เหลือครั้งเดียว) */
export function scheduleChartRefresh(client) {
  clearTimeout(timer);
  timer = setTimeout(() => refreshChart(client), 10000);
}
