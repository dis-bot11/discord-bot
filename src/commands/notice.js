import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { addNotice } from '../db.js';
import { COLORS, when } from '../logger.js';
import { resolveTargetChannel } from '../permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('แจ้งก่อน')
    .setDescription('แจ้งลา / แจ้งไม่ว่างล่วงหน้า')
    .addStringOption((o) =>
      o.setName('ตั้งแต่').setDescription('วันที่/เวลาเริ่ม เช่น 20 พ.ย. 20:00').setRequired(true).setMaxLength(100),
    )
    .addStringOption((o) =>
      o.setName('เหตุผล').setDescription('เหตุผลที่แจ้งก่อน').setRequired(true).setMaxLength(500),
    )
    .addStringOption((o) =>
      o.setName('ถึง').setDescription('ถึงวันที่/เวลา (ถ้ามี) เช่น 22 พ.ย. 18:00').setMaxLength(100),
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const from = interaction.options.getString('ตั้งแต่');
    const to = interaction.options.getString('ถึง');
    const reason = interaction.options.getString('เหตุผล');

    const channel = await resolveTargetChannel(client, config.channels.notice, interaction.channel);

    // เก็บประวัติก่อน เพื่อให้ได้เลขที่แจ้ง
    const id = await addNotice({
      guild_id: interaction.guildId,
      user_id: interaction.user.id,
      user_tag: interaction.user.tag,
      from_text: from,
      to_text: to,
      reason,
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.warn)
      .setTitle(`📝 แจ้งก่อน${id ? ` #${id}` : ''}`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: 'ผู้แจ้ง', value: `${interaction.user}`, inline: true },
        { name: 'ช่วงเวลา', value: to ? `${from} ➜ ${to}` : from, inline: true },
        { name: 'เหตุผล', value: reason },
        { name: 'แจ้งเมื่อ', value: when() },
      );

    try {
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      await interaction.editReply(`❌ ส่งแจ้งก่อนไม่ได้ (บอทมีสิทธิ์ส่งข้อความ/Embed ในห้องนั้นไหม): ${error.message}`);
      return;
    }
    await interaction.editReply(`✅ แจ้งก่อนเรียบร้อย → <#${channel.id}>`);
  },
};
