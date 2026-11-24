import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { getBotGuardStatus } from '../systems/antiNukeSystem.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bot-guard')
    .setDescription('สร้างแผงควบคุมตำรวจป้องกันบอท (โพสต์ถาวรในห้อง)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const isActive = getBotGuardStatus();

    const embed = new EmbedBuilder()
      .setColor(isActive ? '#57F287' : '#ED4245')
      .setTitle('🛡️ แผงควบคุมตำรวจป้องกันบอท (Bot Guard)')
      .setDescription(
        `สถานะปัจจุบัน: **${isActive ? '🟢 เปิดใช้งานอยู่ (บล็อกบอทนอก Whitelist)' : '🔴 ปิดใช้งานชั่วคราว (อนุญาตให้ดึงบอทใหม่)'}**\n\n` +
        `• **เปิดใช้งาน:** เตะบอทแปลกปลอมทันที + แบนบอทคลั่งอัตโนมัติ\n` +
        `• **ปิดชั่วคราว:** กดปิดก่อนดึงบอทตัวใหม่เข้าเซิร์ฟเวอร์ แล้วอย่าลืมกดเปิดกลับ`
      )
      .setFooter({ text: 'แผงควบคุมถาวร • กดปุ่มด้านล่างเพื่อสลับสถานะได้ตลอดเวลา' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_bot_guard')
        .setLabel(isActive ? '🔴 ปิดระบบกันบอทชั่วคราว' : '🟢 เปิดระบบกันบอท')
        .setStyle(isActive ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('refresh_bot_guard')
        .setLabel('🔄 รีเฟรชสถานะ')
        .setStyle(ButtonStyle.Secondary)
    );

    // ส่งลงห้องแบบถาวร (ไม่ใส่ ephemeral)
    await interaction.reply({ embeds: [embed], components: [row] });
  },
};