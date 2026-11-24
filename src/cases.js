import { EmbedBuilder } from 'discord.js';
import { COLORS, formatDuration, when } from './logger.js';

export const KIND_LABEL = {
  warn: 'ตักเตือน',
  timeout: 'Timeout (พักการใช้งาน)',
  kick: 'เตะออก',
  ban: 'แบน',
  unban: 'ปลดแบน',
};

const KIND_COLOR = {
  warn: COLORS.warn,
  timeout: COLORS.bad,
  kick: COLORS.bad,
  ban: COLORS.bad,
  unban: COLORS.good,
};

/** embed ประกาศโทษสาธารณะ */
export function caseEmbed({ id, kind, user, reason, minutes, moderator }) {
  const embed = new EmbedBuilder()
    .setColor(KIND_COLOR[kind] ?? COLORS.info)
    .setTitle(`${kind === 'ban' ? '🔨' : kind === 'kick' ? '👢' : '⚠️'} ประกาศ${KIND_LABEL[kind]}${id ? ` (เคส #${id})` : ''}`)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'ผู้ถูกลงโทษ', value: `${user} (${user.tag})`, inline: true },
      { name: 'ระดับ', value: KIND_LABEL[kind], inline: true },
    );
  if (minutes) {
    embed.addFields({ name: 'ระยะเวลา', value: formatDuration(minutes * 60000), inline: true });
  }
  embed.addFields(
    { name: 'เหตุผล', value: reason },
    { name: 'ผู้สั่ง', value: `${moderator}`, inline: true },
    { name: 'เวลา', value: when(), inline: true },
  );
  return embed;
}
