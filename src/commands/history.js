import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { KIND_LABEL } from '../cases.js';
import { getNotices, getPunishments } from '../db.js';
import { COLORS } from '../logger.js';
import { requireAdmin } from '../permissions.js';

const ts = (iso) => `<t:${Math.floor(new Date(iso).getTime() / 1000)}:d>`;

export default {
  data: new SlashCommandBuilder()
    .setName('ประวัติ')
    .setDescription('ดูประวัติโทษและการแจ้งก่อนของสมาชิก (เฉพาะผู้ดูแล)')
    .addUserOption((o) => o.setName('คน').setDescription('สมาชิกที่ต้องการดู').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('คน');
    const [punishments, notices] = await Promise.all([
      getPunishments(interaction.guildId, user.id),
      getNotices(interaction.guildId, user.id),
    ]);

    if (punishments === null || notices === null) {
      await interaction.editReply('❌ อ่านฐานข้อมูลไม่ได้ (ตรวจว่ารัน schema_v2.sql แล้ว และค่า Supabase ถูกต้อง)');
      return;
    }

    const count = (type) => punishments.filter((p) => p.type === type).length;
    const summary =
      `ตักเตือน ${count('warn')} • Timeout ${count('timeout')} • เตะ ${count('kick')} • แบน ${count('ban')} • ปลดแบน ${count('unban')}`;

    const lines = punishments.slice(0, 10).map((p) => {
      const dur = p.duration_minutes ? ` (${p.duration_minutes} นาที)` : '';
      const reason = (p.reason ?? '—').slice(0, 80);
      return `**#${p.id}** ${ts(p.created_at)} ${KIND_LABEL[p.type] ?? p.type}${dur}: ${reason} — โดย <@${p.moderator_id}>`;
    });

    const noticeLines = notices.slice(0, 3).map((n) => {
      const range = n.to_text ? `${n.from_text} ➜ ${n.to_text}` : n.from_text;
      return `**#${n.id}** ${ts(n.created_at)} ${range}: ${n.reason.slice(0, 60)}`;
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`ประวัติของ ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 128 }))
      .setDescription(`${user}\n${summary}`)
      .addFields(
        {
          name: `ประวัติโทษ (แสดง ${Math.min(10, punishments.length)} จาก ${punishments.length})`,
          value: (lines.join('\n') || '— ไม่มี —').slice(0, 1024),
        },
        {
          name: `แจ้งก่อนล่าสุด (ทั้งหมด ${notices.length} ครั้ง)`,
          value: (noticeLines.join('\n') || '— ไม่มี —').slice(0, 1024),
        },
      );

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};
