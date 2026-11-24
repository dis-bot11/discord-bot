import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { addPunishment } from '../db.js';
import { requireAdmin } from '../permissions.js';
import { recordAction } from '../state.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ปลดแบน')
    .setDescription('ปลดแบนสมาชิกด้วยไอดีผู้ใช้ (เฉพาะผู้ดูแล)')
    .addStringOption((o) =>
      o.setName('รหัสผู้ใช้').setDescription('ไอดีผู้ใช้ที่ถูกแบน (ตัวเลข)').setRequired(true).setMaxLength(25),
    )
    .addStringOption((o) =>
      o.setName('เหตุผล').setDescription('เหตุผลที่ปลดแบน').setRequired(true).setMaxLength(400),
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.options.getString('รหัสผู้ใช้').trim();
    const reason = interaction.options.getString('เหตุผล');

    if (!/^\d{15,25}$/.test(userId)) {
      await interaction.editReply('❌ ไอดีผู้ใช้ต้องเป็นตัวเลขล้วน (คลิกขวาที่คน → Copy User ID ใน Developer Mode)');
      return;
    }

    let ban;
    try {
      ban = await interaction.guild.bans.fetch(userId);
    } catch {
      await interaction.editReply('❌ ไม่พบคนนี้ในรายชื่อที่ถูกแบน');
      return;
    }

    recordAction('unban', userId, interaction.user.id);
    try {
      await interaction.guild.members.unban(userId, `[${interaction.user.tag}] ${reason}`.slice(0, 500));
    } catch (error) {
      await interaction.editReply(`❌ ปลดแบนไม่สำเร็จ: ${error.message}`);
      return;
    }

    const id = await addPunishment({
      guild_id: interaction.guildId,
      user_id: userId,
      user_tag: ban.user.tag,
      type: 'unban',
      reason,
      duration_minutes: null,
      moderator_id: interaction.user.id,
      moderator_tag: interaction.user.tag,
    });
    await interaction.editReply(
      `✅ ปลดแบน ${ban.user.tag} แล้ว${id ? ` (เคส #${id})` : ' ⚠️ แต่บันทึกประวัติไม่ได้ ตรวจว่ารัน schema_v2.sql แล้ว'}`,
    );
  },
};
