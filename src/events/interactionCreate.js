import { Events, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { byName, byPrefix } from '../commands/index.js';
import { isOurGuild, COLORS } from '../logger.js';
import { config } from '../config.js';
import { handleModerationButtons, handleModerationSubmit } from '../systems/moderationSystem.js';
import { getBotGuardStatus, setBotGuardStatus } from '../systems/antiNukeSystem.js';
import { activeSessions } from './voiceStateUpdate.js';
import { supabase, getVoiceTimes } from '../utils/supabase.js'; // 👈 ดึงฟังก์ชันเชื่อม Supabase มาใช้
import { handleBotCommanderInteraction } from '../commands/botCommander.js';

async function replyError(interaction, text) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: text, embeds: [], components: [] });
    } else {
      await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    }
  } catch {
    // ตอบไม่ได้ก็ปล่อย
  }
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!isOurGuild(interaction.guild)) return;

    // 🛰️ ดักจับปุ่มและเมนูของระบบศูนย์บัญชาการบอท (Bot Commander)
    if (await handleBotCommanderInteraction(interaction)) return;

    // 🛡️ ดักจับปุ่มเปิด-ปิด และรีเฟรชแผงถาวรของ Bot Guard
    if (interaction.isButton() && (interaction.customId === 'toggle_bot_guard' || interaction.customId === 'refresh_bot_guard')) {
      try {
        let currentState = getBotGuardStatus();

        if (interaction.customId === 'toggle_bot_guard') {
          currentState = !currentState;
          setBotGuardStatus(currentState);
        }

        const updatedEmbed = new EmbedBuilder()
          .setColor(currentState ? '#57F287' : '#ED4245')
          .setTitle('🛡️ แผงควบคุมตำรวจป้องกันบอท (Bot Guard)')
          .setDescription(
            `สถานะปัจจุบัน: **${currentState ? '🟢 เปิดใช้งานอยู่ (บล็อกบอทนอก Whitelist)' : '🔴 ปิดใช้งานชั่วคราว (อนุญาตให้ดึงบอทใหม่)'}**\n\n` +
            `• **เปิดใช้งาน:** เตะบอทแปลกปลอมทันที + แบนบอทคลั่งอัตโนมัติ\n` +
            `• **ปิดชั่วคราว:** กดปิดก่อนดึงบอทตัวใหม่เข้าเซิร์ฟเวอร์ แล้วอย่าลืมกดเปิดกลับ\n\n` +
            `👤 **อัปเดตล่าสุดโดย:** <@${interaction.user.id}>`
          )
          .setFooter({ text: 'แผงควบคุมถาวร • กดปุ่มด้านล่างเพื่อสลับสถานะได้ตลอดเวลา' })
          .setTimestamp();

        const updatedRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('toggle_bot_guard')
            .setLabel(currentState ? '🔴 ปิดระบบกันบอทชั่วคราว' : '🟢 เปิดระบบกันบอท')
            .setStyle(currentState ? ButtonStyle.Danger : ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('refresh_bot_guard')
            .setLabel('🔄 รีเฟรชสถานะ')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [updatedEmbed], components: [updatedRow] });
        return;
      } catch (error) {
        console.error('[interaction:bot_guard] error:', error);
        await replyError(interaction, '❌ ไม่สามารถอัปเดตสถานะ Bot Guard ได้ในขณะนี้');
        return;
      }
    }

    // 🎙️ ดักจับปุ่มระบบเช็กเวลาออนห้องเสียง & ดูอันดับ (ดึงข้อมูลจาก Supabase โดยตรง)
    if (interaction.isButton() && (interaction.customId === 'btn_check_voicetime' || interaction.customId === 'btn_voice_leaderboard')) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // ดึงข้อมูลเวลาทั้งหมดจาก Supabase
        const dbTimes = await getVoiceTimes();
        const now = Date.now();

        // ปุ่มที่ 1: เช็กเวลาของตัวเอง (เห็นคนเดียว + ส่ง Log ไปห้องบันทึก)
        if (interaction.customId === 'btn_check_voicetime') {
          const userId = interaction.user.id;
          const savedMinutes = dbTimes[userId] || 0;

          let currentSessionMins = 0;
          if (activeSessions.has(userId)) {
            currentSessionMins = Math.floor((now - activeSessions.get(userId)) / 60000);
          }

          const totalMinutes = savedMinutes + currentSessionMins;
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;

          const embed = new EmbedBuilder()
            .setColor(COLORS.info)
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setTitle('⏱️ สถิติเวลาออนห้องเสียงของคุณ')
            .addFields(
              { name: 'เวลาสะสมทั้งหมด', value: `**${hours} ชั่วโมง ${mins} นาที**`, inline: true },
              { name: 'รอบปัจจุบัน', value: currentSessionMins > 0 ? `+${currentSessionMins} นาที` : 'ไม่อยู่ในห้องเสียง', inline: true }
            );

          await interaction.editReply({ embeds: [embed] });

          // ส่งประวัติไปห้องบันทึกเวลาตามไอดีที่กำหนด
          const recordChannelId = '1573560219777376346';
          const recordChannel = interaction.guild.channels.cache.get(recordChannelId);
          if (recordChannel) {
            const publicEmbed = new EmbedBuilder()
              .setColor(COLORS.good)
              .setTitle('📊 บันทึกการตรวจสอบเวลาออนเสียง')
              .setDescription(`สมาชิก: ${interaction.user} (${interaction.user.tag})\n⏱️ เวลาสะสม: **${hours} ชม. ${mins} นาที**`)
              .setTimestamp();
            await recordChannel.send({ embeds: [publicEmbed] }).catch(() => {});
          }
          return;
        }

        // ปุ่มที่ 2: ดู 10 อันดับสูงสุด (เห็นคนเดียว)
        if (interaction.customId === 'btn_voice_leaderboard') {
          // รวมเวลาสดของคนที่กำลังออนอยู่เข้ากับฐานข้อมูลก่อนจัดอันดับ
          const combined = { ...dbTimes };
          for (const [userId, joinedAt] of activeSessions.entries()) {
            const liveMinutes = Math.floor((now - joinedAt) / 60000);
            combined[userId] = (combined[userId] || 0) + liveMinutes;
          }

          const sorted = Object.entries(combined)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

          const rankList = sorted.length
            ? sorted
                .map(([id, m], idx) => {
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
                  return `${medal} <@${id}> — \`${Math.floor(m / 60)} ชม. ${m % 60} นาที\``;
                })
                .join('\n')
            : 'ยังไม่มีข้อมูลเวลาสะสมในระบบ';

          const embed = new EmbedBuilder()
            .setColor(COLORS.good)
            .setTitle('🏆 10 อันดับยอดออนห้องเสียงสูงสุด')
            .setDescription(rankList);

          await interaction.editReply({ embeds: [embed] });
          return;
        }
      } catch (error) {
        console.error('[interaction:voicetime_button] error:', error);
        await replyError(interaction, '❌ เกิดข้อผิดพลาดในการตรวจสอบเวลาออนเสียง');
        return;
      }
    }

    // 🛡️ ดักจับปุ่มและ Modal ของระบบลงโทษ
    if (await handleModerationButtons(interaction)) return;
    if (await handleModerationSubmit(interaction)) return;

    try {
      if (interaction.isChatInputCommand()) {
        await byName.get(interaction.commandName)?.execute(interaction, client);
      } else if (interaction.isModalSubmit() || interaction.isButton()) {
        const prefix = interaction.customId.split(':')[0];
        await byPrefix.get(prefix)?.handleComponent?.(interaction, client);
      }
    } catch (error) {
      console.error(`[interaction:${interaction.commandName ?? interaction.customId}] error:`, error);
      await replyError(interaction, '❌ เกิดข้อผิดพลาดในการทำงานของบอท ลองใหม่อีกครั้ง');
    }
  },
};