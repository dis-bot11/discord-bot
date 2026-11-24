import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { caseEmbed } from '../cases.js';
import { config } from '../config.js';
import { addPunishment } from '../db.js';
import { checkTarget, requireAdmin, resolveTargetChannel } from '../permissions.js';
import { recordAction } from '../state.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ลงโทษ')
    .setDescription('ตักเตือน / Timeout / เตะ สมาชิก พร้อมประกาศและบันทึกประวัติ (เฉพาะผู้ดูแล)')
    .addUserOption((o) => o.setName('คน').setDescription('คนที่จะลงโทษ').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('ระดับ')
        .setDescription('ระดับโทษ')
        .setRequired(true)
        .addChoices(
          { name: 'ตักเตือน (บันทึก + ประกาศ)', value: 'warn' },
          { name: 'Timeout (พักการใช้งานจริง)', value: 'timeout' },
          { name: 'เตะออกจากเซิร์ฟเวอร์', value: 'kick' },
        ),
    )
    .addStringOption((o) =>
      o.setName('เหตุผล').setDescription('เหตุผลในการลงโทษ').setRequired(true).setMaxLength(400),
    )
    .addIntegerOption((o) =>
      o
        .setName('ระยะเวลา')
        .setDescription('ใช้เฉพาะ Timeout')
        .addChoices(
          { name: '10 นาที', value: 10 },
          { name: '1 ชั่วโมง', value: 60 },
          { name: '6 ชั่วโมง', value: 360 },
          { name: '1 วัน', value: 1440 },
          { name: '3 วัน', value: 4320 },
          { name: '7 วัน', value: 10080 },
        ),
    ),

  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('คน');
    const member = interaction.options.getMember('คน');
    const kind = interaction.options.getString('ระดับ');
    const reason = interaction.options.getString('เหตุผล');
    const minutes = interaction.options.getInteger('ระยะเวลา');

    if (!member) {
      await interaction.editReply('❌ ไม่พบคนนี้ในเซิร์ฟเวอร์');
      return;
    }
    if (user.bot) {
      await interaction.editReply('❌ ลงโทษบอทผ่านคำสั่งนี้ไม่ได้');
      return;
    }
    if (kind === 'timeout' && !minutes) {
      await interaction.editReply('❌ Timeout ต้องเลือก "ระยะเวลา" ด้วย');
      return;
    }

    const problem = checkTarget(interaction.guild, interaction.member, member, kind);
    if (problem) {
      await interaction.editReply(`❌ ${problem}`);
      return;
    }

    if (kind === 'timeout') {
      // จดไว้ก่อนสั่ง เพื่อให้ log แสดงชื่อแอดมินตัวจริงแทนบอท
      recordAction('timeout', user.id, interaction.user.id);
      try {
        await member.timeout(minutes * 60000, `[${interaction.user.tag}] ${reason}`.slice(0, 500));
      } catch (error) {
        await interaction.editReply(`❌ Timeout ไม่สำเร็จ: ${error.message}`);
        return;
      }
    }

    if (kind === 'kick') {
      recordAction('kick', user.id, interaction.user.id);
      try {
        await member.kick(`[${interaction.user.tag}] ${reason}`.slice(0, 500));
      } catch (error) {
        await interaction.editReply(`❌ เตะไม่สำเร็จ: ${error.message}`);
        return;
      }
    }

    const id = await addPunishment({
      guild_id: interaction.guildId,
      user_id: user.id,
      user_tag: user.tag,
      type: kind,
      reason,
      duration_minutes: kind === 'timeout' ? minutes : null,
      moderator_id: interaction.user.id,
      moderator_tag: interaction.user.tag,
    });

    const channel = await resolveTargetChannel(
      client,
      config.channels.punish ?? config.channels.announce,
      interaction.channel,
    );
    try {
      await channel.send({
        embeds: [
          caseEmbed({
            id,
            kind,
            user,
            reason,
            minutes: kind === 'timeout' ? minutes : null,
            moderator: interaction.user,
          }),
        ],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      await interaction.editReply(
        `⚠️ ลงโทษและบันทึกแล้ว แต่ประกาศในห้องไม่ได้ (${error.message})${id ? '' : ' และบันทึกประวัติไม่ได้ ตรวจว่ารัน schema_v2.sql แล้ว'}`,
      );
      return;
    }

    await interaction.editReply(
      `✅ ดำเนินการแล้ว${id ? ` (เคส #${id})` : ' ⚠️ แต่บันทึกประวัติลงฐานข้อมูลไม่ได้ ตรวจว่ารัน schema_v2.sql แล้ว'} → <#${channel.id}>`,
    );
  },
};
