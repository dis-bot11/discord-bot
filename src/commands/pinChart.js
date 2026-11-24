import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { buildChartEmbed } from '../chart.js';
import { getChartMessage, saveChartMessage } from '../db.js';
import { requireAdmin } from '../permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ปักผังแฟม')
    .setDescription('โพสต์ผังแฟมไว้ในห้องนี้ และให้อัปเดตเองเมื่อมีการเปลี่ยนยศ (เฉพาะผู้ดูแล)'),
  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let message;
    try {
      message = await interaction.channel.send({ embeds: [buildChartEmbed(interaction.guild)] });
    } catch (error) {
      await interaction.editReply(`❌ โพสต์ในห้องนี้ไม่ได้ (บอทมีสิทธิ์ส่งข้อความ/Embed ในห้องนี้ไหม): ${error.message}`);
      return;
    }

    // ลบผังเก่า (ถ้ามี) เพื่อไม่ให้มีผังซ้ำหลายอัน
    const old = await getChartMessage(interaction.guildId);
    if (old && old.message_id !== message.id) {
      try {
        const oldChannel = await client.channels.fetch(old.channel_id);
        await oldChannel.messages.delete(old.message_id);
      } catch {
        // ลบไม่ได้ก็ไม่เป็นไร
      }
    }

    const saved = await saveChartMessage(interaction.guildId, message.channelId, message.id);
    await interaction.editReply(
      saved
        ? '✅ ปักผังแฟมแล้ว จะอัปเดตเองเมื่อมีการเปลี่ยนยศ'
        : '⚠️ โพสต์ผังแล้ว แต่บันทึกลงฐานข้อมูลไม่ได้ ผังนี้จะไม่อัปเดตเอง (ตรวจว่ารัน schema_v2.sql แล้ว)',
    );
  },
};
