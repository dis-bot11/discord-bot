import { Events, MessageFlags } from 'discord.js';
import { requireAdmin } from '../permissions.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('admin_btn_')) return;

    // เช็กสิทธิ์ก่อนให้กดปุ่ม (ป้องกันคนอื่นแอบมากกด)
    if (!(await requireAdmin(interaction))) {
      return await interaction.reply({
        content: '❌ คุณไม่มีสิทธิ์ใช้งานปุ่มควบคุมนี้!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const action = interaction.customId.replace('admin_btn_', '');

    switch (action) {
      case 'annouce':
        await interaction.reply({ content: '📢 กรุณาใช้คำสั่ง `/ประกาศ` เพื่อพิมพ์ข้อความประกาศผ่านบอทค่ะ', flags: MessageFlags.Ephemeral });
        break;
      case 'rules':
        await interaction.reply({ content: '📜 ระบบโพสต์กฎแฟมกำลังพัฒนาเพิ่มเติมค่ะ', flags: MessageFlags.Ephemeral });
        break;
      case 'status':
        await interaction.reply({ content: `🤖 บอทออนไลน์ปกติ! ปิงปัจจุบัน: ${interaction.client.ws.ping}ms`, flags: MessageFlags.Ephemeral });
        break;
      case 'lock':
        await interaction.reply({ content: '🔒 ฟังก์ชันล็อกห้องฉุกเฉินยังไม่เปิดใช้งาน', flags: MessageFlags.Ephemeral });
        break;
      default:
        await interaction.reply({ content: '⚠️ ไม่พบคำสั่งนี้ในระบบปุ่ม', flags: MessageFlags.Ephemeral });
    }
  },
};