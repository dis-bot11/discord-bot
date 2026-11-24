import { EmbedBuilder, Events } from 'discord.js';
import { config, logChannelIds } from '../config.js';
import { COLORS, isOurGuild, sendLog, truncate } from '../logger.js';

export default {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage, client) {
    if (!newMessage.guild || !isOurGuild(newMessage.guild)) return;
    if (newMessage.author?.bot) return;
    if (logChannelIds.has(newMessage.channelId)) return;

    // เนื้อหาไม่เปลี่ยน (เช่น embed ลิงก์โหลดเสร็จ) ไม่ต้อง log
    if (oldMessage.content === newMessage.content) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.warn)
      .setTitle('📝 ข้อความถูกแก้ไข')
      .addFields(
        {
          name: 'ผู้เขียน',
          value: newMessage.author ? `${newMessage.author} (${newMessage.author.tag})` : 'ไม่ทราบ',
          inline: true,
        },
        { name: 'ห้อง', value: `<#${newMessage.channelId}>`, inline: true },
        { name: 'ก่อนแก้', value: truncate(oldMessage.content ?? null, 900) },
        { name: 'หลังแก้', value: truncate(newMessage.content ?? null, 900) },
        { name: 'ลิงก์', value: `[ไปที่ข้อความ](${newMessage.url})` },
      )
      .setFooter({ text: `Message ID: ${newMessage.id}` });

    await sendLog(client, config.channels.message, embed);
  },
};
