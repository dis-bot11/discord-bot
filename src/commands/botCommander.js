import fs from 'node:fs';
import path from 'node:path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { requireAdmin } from '../permissions.js';

export const BOT_PANEL_PATH = path.resolve('bot-commander-panel.json');

// ฟังก์ชันสแกนบอททั้งหมดและสร้าง Embed แผงบัญชาการ
export async function generateBotCommanderEmbed(guild) {
  const members = await guild.members.fetch();
  const bots = members.filter((m) => m.user.bot);

  let onlineCount = 0;
  let offlineCount = 0;
  const botLines = [];

  // เรียงเอาบอทที่ออนไลน์ขึ้นก่อน และเรียงตามตัวอักษร
  const sortedBots = [...bots.values()].sort((a, b) => {
    const aOnline = a.presence?.status && a.presence.status !== 'offline' ? 1 : 0;
    const bOnline = b.presence?.status && b.presence.status !== 'offline' ? 1 : 0;
    if (bOnline !== aOnline) return bOnline - aOnline;
    return a.user.username.localeCompare(b.user.username);
  });

  for (const bot of sortedBots) {
    const status = bot.presence?.status;
    const isOnline = status && status !== 'offline';
    if (isOnline) onlineCount++;
    else offlineCount++;

    const statusIcon = isOnline ? '🟢' : '⚫';
    const isAdmin = bot.permissions.has(PermissionFlagsBits.Administrator);
    const hasDangerPerm =
      isAdmin ||
      bot.permissions.has(PermissionFlagsBits.ManageGuild) ||
      bot.permissions.has(PermissionFlagsBits.BanMembers) ||
      bot.permissions.has(PermissionFlagsBits.ManageRoles);

    const badge = isAdmin ? ' `⚠️ ADMIN`' : hasDangerPerm ? ' `⚡ สิทธิ์สูง`' : '';
    const isSelf = bot.id === guild.client.user.id ? ' *(ผู้บัญชาการ)*' : '';

    botLines.push(`${statusIcon} **${bot.user.tag}**${isSelf}${badge}`);
  }

  return new EmbedBuilder()
    .setColor('#8B0000')
    .setTitle('🛰️ ศูนย์บัญชาการและเรดาร์เฝ้าระวังบอท — ราเซีย')
    .setDescription(
      `ระบบตรวจจับสถานะและสิทธิ์การทำงานของบอททั้งหมดในเซิร์ฟเวอร์แบบเรียลไทม์\n\n` +
        `📊 **สรุปภาพรวม:** ทั้งหมด **${bots.size}** ตัว | 🟢 ออนไลน์ **${onlineCount}** | ⚫ ออฟไลน์ **${offlineCount}**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        (botLines.length > 0 ? botLines.join('\n') : 'ไม่พบบอทในเซิร์ฟเวอร์'),
    )
    .setFooter({ text: 'อัปเดตสถานะอัตโนมัติทุก 1 นาที • ระบบป้องกันเซิร์ฟเวอร์ทำงานปกติ' })
    .setTimestamp();
}

// ฟังก์ชันสร้างปุ่มกดใต้แผงควบคุม
export function generateBotCommanderComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('botcmd_refresh')
        .setLabel('🔄 รีเฟรชสถานะ')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('botcmd_audit')
        .setLabel('🛡️ สแกนสิทธิ์อันตราย')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('botcmd_kick_menu')
        .setLabel('👢 สั่งเตะบอท')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

// ตัวจัดการเมื่อแอดมินกดปุ่มหรือเลือกเมนูบนแผงบัญชาการ
export async function handleBotCommanderInteraction(interaction) {
  if (!interaction.customId?.startsWith('botcmd_')) return false;

  if (!(await requireAdmin(interaction))) return true;

  const guild = interaction.guild;

  // 1. ปุ่มรีเฟรชสถานะทันที
  if (interaction.isButton() && interaction.customId === 'botcmd_refresh') {
    await interaction.deferUpdate();
    const embed = await generateBotCommanderEmbed(guild);
    await interaction.message.edit({ embeds: [embed], components: generateBotCommanderComponents() });
    return true;
  }

  // 2. ปุ่มสแกนสิทธิ์อันตรายเชิงลึก
  if (interaction.isButton() && interaction.customId === 'botcmd_audit') {
    const members = await guild.members.fetch();
    const bots = members.filter((m) => m.user.bot && m.id !== guild.client.user.id);

    const reportLines = [];
    for (const bot of bots.values()) {
      const dangers = [];
      if (bot.permissions.has(PermissionFlagsBits.Administrator)) dangers.push('Administrator (แอดมินสูงสุด)');
      if (bot.permissions.has(PermissionFlagsBits.ManageGuild)) dangers.push('จัดการเซิร์ฟเวอร์');
      if (bot.permissions.has(PermissionFlagsBits.ManageChannels)) dangers.push('สร้าง/ลบห้อง');
      if (bot.permissions.has(PermissionFlagsBits.ManageRoles)) dangers.push('สร้าง/ลบยศ');
      if (bot.permissions.has(PermissionFlagsBits.BanMembers)) dangers.push('แบนสมาชิก');
      if (bot.permissions.has(PermissionFlagsBits.KickMembers)) dangers.push('เตะสมาชิก');

      const joinedDate = bot.joinedAt ? `<t:${Math.floor(bot.joinedAt.getTime() / 1000)}:D>` : 'ไม่ทราบ';
      if (dangers.length > 0) {
        reportLines.push(`🚨 **${bot.user.tag}** (เข้าเมื่อ ${joinedDate})\n└ สิทธิ์: \`${dangers.join(', ')}\``);
      } else {
        reportLines.push(`✅ **${bot.user.tag}** — สิทธิ์ปลอดภัยทั่วไป`);
      }
    }

    const auditEmbed = new EmbedBuilder()
      .setColor('#FF4500')
      .setTitle('🛡️ รายงานตรวจสอบสิทธิ์บอทเชิงลึก')
      .setDescription(reportLines.length > 0 ? reportLines.join('\n\n') : 'ไม่มีบอทตัวอื่นในเซิร์ฟเวอร์')
      .setFooter({ text: 'ข้อความนี้เห็นเฉพาะแอดมินที่กดตรวจสอบเท่านั้น' });

    await interaction.reply({ embeds: [auditEmbed], flags: MessageFlags.Ephemeral });
    return true;
  }

  // 3. ปุ่มเปิดเมนูเลือกเตะบอท
  if (interaction.isButton() && interaction.customId === 'botcmd_kick_menu') {
    const members = await guild.members.fetch();
    const otherBots = members.filter((m) => m.user.bot && m.id !== guild.client.user.id);

    if (otherBots.size === 0) {
      await interaction.reply({ content: 'ℹ️ ไม่มีบอทตัวอื่นให้เตะในเซิร์ฟเวอร์ครับ', flags: MessageFlags.Ephemeral });
      return true;
    }

    const options = otherBots.first(25).map((bot) => ({
      label: bot.user.tag.slice(0, 100),
      description: `ID: ${bot.id} | สถานะ: ${bot.presence?.status || 'offline'}`,
      value: bot.id,
    }));

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('botcmd_kick_select')
        .setPlaceholder('เลือกบอทที่ต้องการเตะออกจากเซิร์ฟเวอร์...')
        .addOptions(options),
    );

    await interaction.reply({
      content: '⚠️ **คำสั่งปลดบอท:** เลือกบอทที่ต้องการดีดออกจากเซิร์ฟเวอร์ทันที',
      components: [selectRow],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  // 4. เมื่อเลือกชื่อบอทในเมนูเพื่อทำการเตะ
  if (interaction.isStringSelectMenu() && interaction.customId === 'botcmd_kick_select') {
    const targetId = interaction.values[0];
    const targetBot = await guild.members.fetch(targetId).catch(() => null);

    if (!targetBot) {
      await interaction.update({ content: '❌ ไม่พบบอทตัวนี้แล้ว (อาจออกจากเซิร์ฟเวอร์ไปแล้ว)', components: [] });
      return true;
    }

    if (!targetBot.kickable) {
      await interaction.update({
        content: `❌ เตะ **${targetBot.user.tag}** ไม่ได้ เนื่องจากยศของบอทตัวนี้อยู่สูงกว่ายศของผู้คุมกฎ`,
        components: [],
      });
      return true;
    }

    const botTag = targetBot.user.tag;
    await targetBot.kick(`สั่งปลดโดยแอดมิน ${interaction.user.tag} ผ่านแผงบัญชาการบอท`);

    await interaction.update({
      content: `✅ สั่งเตะบอท **${botTag}** ออกจากเซิร์ฟเวอร์เรียบร้อยแล้ว!`,
      components: [],
    });

    // อัปเดตแผงหลักทันทีหลังเตะเสร็จ
    if (fs.existsSync(BOT_PANEL_PATH)) {
      const { channelId, messageId } = JSON.parse(fs.readFileSync(BOT_PANEL_PATH, 'utf8'));
      const panelChannel = await guild.channels.fetch(channelId).catch(() => null);
      const panelMsg = await panelChannel?.messages.fetch(messageId).catch(() => null);
      if (panelMsg) {
        const updatedEmbed = await generateBotCommanderEmbed(guild);
        await panelMsg.edit({ embeds: [updatedEmbed], components: generateBotCommanderComponents() });
      }
    }
    return true;
  }

  return false;
}

export default {
  data: new SlashCommandBuilder()
    .setName('แผงคุมบอท')
    .setDescription('ตั้งแผงเรดาร์โชว์สถานะและปุ่มควบคุมบอททั้งหมดในเซิร์ฟเวอร์ (เฉพาะแอดมิน)'),
  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = await generateBotCommanderEmbed(interaction.guild);
    const components = generateBotCommanderComponents();

    const sentMessage = await interaction.channel.send({ embeds: [embed], components });

    // บันทึกตำแหน่งข้อความแผงควบคุมไว้เพื่ออัปเดตอัตโนมัติทุก 1 นาที
    fs.writeFileSync(
      BOT_PANEL_PATH,
      JSON.stringify({ channelId: interaction.channel.id, messageId: sentMessage.id }, null, 2),
      'utf8',
    );

    await interaction.editReply({ content: '✅ ตั้งแผงศูนย์บัญชาการบอทเรียบร้อยแล้ว! ระบบจะอัปเดตสถานะอัตโนมัติทุก 1 นาที' });
  },
};