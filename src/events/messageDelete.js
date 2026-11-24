import { AuditLogEvent, EmbedBuilder, Events } from 'discord.js';
import { config, logChannelIds } from '../config.js';
import { COLORS, isOurGuild, sendLog, truncate } from '../logger.js';

export default {
  name: Events.MessageDelete,
  async execute(message, client) {
    if (!message.guild || !isOurGuild(message.guild)) return;
    if (message.author?.bot) return;
    // กัน loop: ไม่ log การลบข้อความในห้อง log เอง
    if (logChannelIds.has(message.channelId)) return;

    let deletedBy = '⚡ ลบโดยระบบ AutoMod หรือ Discord (ไม่มีบันทึกใน Audit Log)';
    let actionType = 'AutoMod / System';

    try {
      // รอเสี้ยววินาทีเพื่อให้ Discord บันทึก Audit Log ฝั่งเซิร์ฟเวอร์
      await new Promise((resolve) => setTimeout(resolve, 500));

      const auditLogs = await message.guild.fetchAuditLogs({
        limit: 5,
        type: AuditLogEvent.MessageDelete,
      });

      // ค้นหาบันทึกการลบที่ตรงกับห้องและผู้เขียนข้อความคนนี้ในเวลาไล่เลี่ยกัน
      const deletionEntry = auditLogs.entries.find(
        (entry) =>
          entry.target?.id === message.author?.id &&
          entry.extra?.channel?.id === message.channelId
      );

      if (deletionEntry) {
        const { executor, createdAt } = deletionEntry;
        // เช็กว่าเวลาใกล้เคียงกันไหม (ภายใน 3 วินาที)
        if (Math.abs(Date.now() - createdAt.getTime()) < 3000) {
          if (executor.bot) {
            deletedBy = `🤖 บอทภายนอก: **${executor.tag}** (ID: ${executor.id})`;
            actionType = 'Bot Deletion';
          } else {
            deletedBy = `🛡️ แอดมิน/ผู้ดูแล: **${executor.tag}** (ID: ${executor.id})`;
            actionType = 'Manual Delete';
          }
        }
      }
    } catch (err) {
      console.error('[Log Error] ไม่สามารถดึง Audit Log ได้:', err);
    }

    const author = message.author ? `${message.author} (${message.author.tag})` : 'ไม่ทราบ (ข้อความแคชหาย)';
    const content = message.content ? truncate(message.content) : '*[ไม่มีข้อความ / อาจเป็นรูปภาพ, Embed หรือลิงก์ที่ถูกซ่อน]*';
    const attachments = message.attachments?.size
      ? message.attachments.map((a) => a.name).join(', ')
      : null;

    const embed = new EmbedBuilder()
      .setColor(COLORS.bad)
      .setTitle('🗑️ รายละเอียดการลบข้อความ')
      .addFields(
        { name: 'ผู้เขียนข้อความ', value: author, inline: true },
        { name: 'ห้องแชท', value: `<#${message.channelId}>`, inline: true },
        { name: '🔍 ตัวการที่ลบ', value: deletedBy, inline: false },
        { name: 'เนื้อหาที่ถูกลบ', value: content, inline: false },
      )
      .setFooter({ text: `Message ID: ${message.id} | Type: ${actionType}` });

    if (attachments) {
      embed.addFields({ name: 'ไฟล์แนบ', value: truncate(attachments) });
    }

    await sendLog(client, config.channels.message, embed);
  },
};