import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { config } from '../config.js';
import { COLORS, sendLog, when } from '../logger.js';
import { isAdmin, requireAdmin, resolveTargetChannel } from '../permissions.js';

export default {
  prefix: 'announce',
  data: new SlashCommandBuilder()
    .setName('ประกาศ')
    .setDescription('ส่งประกาศของแฟม (เฉพาะผู้ดูแล)')
    .addBooleanOption((o) => o.setName('แท็กทุกคน').setDescription('แท็ก @everyone'))
    .addRoleOption((o) => o.setName('แท็กยศ').setDescription('แท็กยศที่เลือก')),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const everyone = interaction.options.getBoolean('แท็กทุกคน') ? 1 : 0;
    const role = interaction.options.getRole('แท็กยศ');

    const modal = new ModalBuilder()
      .setCustomId(`announce:${everyone}:${role?.id ?? 0}`)
      .setTitle('เขียนประกาศ')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('หัวข้อ')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(200)
            .setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('body')
            .setLabel('เนื้อหา')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(3500)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
  },

  async handleComponent(interaction, client) {
    if (!interaction.isModalSubmit()) return;
    if (!isAdmin(interaction.member)) {
      await interaction.reply({ content: '⛔ ไม่มีสิทธิ์', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, everyoneFlag, roleIdRaw] = interaction.customId.split(':');
    let everyone = everyoneFlag === '1';
    let roleId = roleIdRaw !== '0' ? roleIdRaw : null;
    if (roleId === interaction.guildId) {
      everyone = true; // เลือกยศ @everyone = แท็กทุกคน
      roleId = null;
    }

    const title = interaction.fields.getTextInputValue('title');
    const body = interaction.fields.getTextInputValue('body');

    const mentions = [everyone ? '@everyone' : null, roleId ? `<@&${roleId}>` : null].filter(Boolean);
    const channel = await resolveTargetChannel(client, config.channels.announce, interaction.channel);

    try {
      await channel.send({
        content: mentions.join(' ') || undefined,
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.info)
            .setAuthor({ name: `ประกาศจากแฟม ${config.familyName} [${config.familyTag}]` })
            .setTitle(title)
            .setDescription(body)
            .setFooter({ text: `ประกาศโดย ${interaction.member.displayName}` })
            .setTimestamp(),
        ],
        allowedMentions: { parse: everyone ? ['everyone'] : [], roles: roleId ? [roleId] : [] },
      });
    } catch (error) {
      await interaction.editReply(`❌ ส่งประกาศไม่ได้ (บอทมีสิทธิ์ส่งข้อความ/Embed ในห้องนั้นไหม): ${error.message}`);
      return;
    }

    await sendLog(
      client,
      config.channels.mod,
      new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('📢 มีการส่งประกาศ')
        .addFields(
          { name: 'ผู้ประกาศ', value: `${interaction.user}`, inline: true },
          { name: 'ห้อง', value: `<#${channel.id}>`, inline: true },
          { name: 'หัวข้อ', value: title.slice(0, 250) },
          { name: 'เวลา', value: when() },
        ),
    );
    await interaction.editReply(`✅ ส่งประกาศแล้ว → <#${channel.id}>`);
  },
};
