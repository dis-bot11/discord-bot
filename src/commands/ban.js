import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { caseEmbed } from '../cases.js';
import { config } from '../config.js';
import { addPunishment } from '../db.js';
import { COLORS } from '../logger.js';
import { checkTarget, isAdmin, requireAdmin, resolveTargetChannel } from '../permissions.js';
import { recordAction } from '../state.js';

// คำสั่งแบนที่รอกดยืนยัน (อยู่ในหน่วยความจำ หมดอายุใน 2 นาที)
const pending = new Map();
const EXPIRE_MS = 2 * 60 * 1000;

export default {
  prefix: 'ban',
  data: new SlashCommandBuilder()
    .setName('แบน')
    .setDescription('แบนสมาชิก พร้อมประกาศและบันทึกประวัติ (เฉพาะผู้ดูแล มีขั้นยืนยัน)')
    .addUserOption((o) => o.setName('คน').setDescription('คนที่จะแบน').setRequired(true))
    .addStringOption((o) =>
      o.setName('เหตุผล').setDescription('เหตุผลในการแบน').setRequired(true).setMaxLength(400),
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const user = interaction.options.getUser('คน');
    const member = interaction.options.getMember('คน');
    const reason = interaction.options.getString('เหตุผล');

    const problem = checkTarget(interaction.guild, interaction.member, member, 'ban');
    if (problem) {
      await interaction.reply({ content: `❌ ${problem}`, flags: MessageFlags.Ephemeral });
      return;
    }
    if (user.id === interaction.client.user.id) {
      await interaction.reply({ content: '❌ แบนตัวบอทเองไม่ได้', flags: MessageFlags.Ephemeral });
      return;
    }

    const token = randomUUID().slice(0, 8);
    pending.set(token, { targetId: user.id, reason, invokerId: interaction.user.id, at: Date.now() });
    if (pending.size > 50) pending.delete(pending.keys().next().value);

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.bad)
          .setTitle('ยืนยันการแบน?')
          .setDescription(`${user} (${user.tag})\n\n**เหตุผล:** ${reason}`)
          .setFooter({ text: 'ยืนยันภายใน 2 นาที' }),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ban:ok:${token}`).setLabel('ยืนยันแบน').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`ban:no:${token}`).setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
  },

  async handleComponent(interaction, client) {
    if (!interaction.isButton()) return;
    const [, action, token] = interaction.customId.split(':');
    const job = pending.get(token);

    if (!job || Date.now() - job.at > EXPIRE_MS) {
      pending.delete(token);
      await interaction.update({ content: '⌛ หมดเวลายืนยัน กรุณาสั่งใหม่', embeds: [], components: [] });
      return;
    }
    if (interaction.user.id !== job.invokerId || !isAdmin(interaction.member)) {
      await interaction.reply({ content: '⛔ ปุ่มนี้สำหรับคนที่สั่งแบนเท่านั้น', flags: MessageFlags.Ephemeral });
      return;
    }
    pending.delete(token);

    if (action === 'no') {
      await interaction.update({ content: 'ยกเลิกการแบนแล้ว', embeds: [], components: [] });
      return;
    }

    await interaction.deferUpdate();
    const guild = interaction.guild;

    // จดไว้ก่อนสั่ง เพื่อให้ log แสดงชื่อแอดมินตัวจริงแทนบอท
    recordAction('ban', job.targetId, interaction.user.id);
    try {
      await guild.members.ban(job.targetId, {
        reason: `[${interaction.user.tag}] ${job.reason}`.slice(0, 500),
      });
    } catch (error) {
      await interaction.editReply({ content: `❌ แบนไม่สำเร็จ: ${error.message}`, embeds: [], components: [] });
      return;
    }

    const user = await client.users.fetch(job.targetId);
    const id = await addPunishment({
      guild_id: guild.id,
      user_id: user.id,
      user_tag: user.tag,
      type: 'ban',
      reason: job.reason,
      duration_minutes: null,
      moderator_id: interaction.user.id,
      moderator_tag: interaction.user.tag,
    });

    const channel = await resolveTargetChannel(
      client,
      config.channels.punish ?? config.channels.announce,
      interaction.channel,
    );
    let announced = true;
    try {
      await channel.send({
        embeds: [caseEmbed({ id, kind: 'ban', user, reason: job.reason, moderator: interaction.user })],
        allowedMentions: { parse: [] },
      });
    } catch {
      announced = false;
    }

    await interaction.editReply({
      content:
        `✅ แบน ${user.tag} แล้ว${id ? ` (เคส #${id})` : ' ⚠️ แต่บันทึกประวัติไม่ได้ ตรวจว่ารัน schema_v2.sql แล้ว'}` +
        (announced ? ` → <#${channel.id}>` : ' ⚠️ แต่ประกาศในห้องไม่ได้'),
      embeds: [],
      components: [],
    });
  },
};
