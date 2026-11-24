import { Events, MessageFlags } from 'discord.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('role_btn_')) return;

    const roleId = interaction.customId.replace('role_btn_', '');
    const member = interaction.member;
    const guild = interaction.guild;

    const role = guild.roles.cache.get(roleId);
    if (!role) {
      return await interaction.reply({
        content: '❌ ไม่พบยศนี้ในระบบ หรืออาจถูกลบไปแล้ว',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        await interaction.reply({
          content: `❌ คุณได้ทำการถอดสิทธิ์ยศ **${role.name}** ออกแล้ว`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await member.roles.add(roleId);
        await interaction.reply({
          content: `✅ ยินดีต้อนรับเข้าสู่แฟมสุภาพสตรีค่ะ! คุณได้รับยศ **${role.name}** และปลดล็อกห้องทั้งหมดเรียบร้อย 🌸`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error('[RoleButton] เกิดข้อผิดพลาด:', error);
      
      // ป้องกันกรณีที่ interaction เคยตอบสนองไปแล้ว
      const replyMethod = interaction.replied || interaction.deferred ? 'followUp' : 'reply';
      await interaction[replyMethod]({
        content: '⚠️ บอทไม่มีสิทธิ์จัดการยศนี้ (กรุณาให้แอดมินขยับยศของบอทให้อยู่สูงกว่ายศที่จะแจก)',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};