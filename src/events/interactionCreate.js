import { Events, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { byName, byPrefix } from '../commands/index.js';
import { isOurGuild, COLORS } from '../logger.js';
import { config } from '../config.js';
import { handleModerationButtons, handleModerationSubmit } from '../systems/moderationSystem.js';
import { getBotGuardStatus, setBotGuardStatus } from '../systems/antiNukeSystem.js';
import { supabase } from '../utils/supabase.js';
import { handleBotCommanderInteraction } from '../commands/botCommander.js';

// ☁️ ฟังก์ชันดึงและรวมยอดข้อมูลพร้อมใส่ Debug
async function getCombinedVoiceTimes() {
  try {
    console.log('[DEBUG BUTTON] Fetching voice times from 3 tables...');
    const [oldRes, histRes, currRes] = await Promise.all([
      supabase.from('voice_times_old').select('user_id, minutes'),
      supabase.from('voice_times_historical').select('user_id, minutes'),
      supabase.from('voice_times').select('user_id, minutes')
    ]);

    console.log('[DEBUG BUTTON] oldRes:', oldRes.data?.length || 0, 'rows');
    console.log('[DEBUG BUTTON] histRes:', histRes.data?.length || 0, 'rows');
    console.log('[DEBUG BUTTON] currRes:', currRes.data?.length || 0, 'rows');

    const totals = {};
    const addData = (rows) => {
      if (!rows) return;
      for (const row of rows) {
        if (!row.user_id) continue;
        totals[row.user_id] = (totals[row.user_id] || 0) + (row.minutes || 0);
      }
    };

    addData(oldRes.data);
    addData(histRes.data);
    addData(currRes.data);

    console.log('[DEBUG BUTTON] Combined totals success. Total users:', Object.keys(totals).length);
    return totals;
  } catch (error) {
    console.error('[DEBUG BUTTON ERROR] Error fetching combined voice times:', error);
    return {};
  }
}

async function replyError(interaction, text) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: text, embeds: [], components: [] });
    } else {
      await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    console.error('[DEBUG BUTTON ERROR] replyError failed:', err);
  }
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!isOurGuild(interaction.guild)) return;

    if (await handleBotCommanderInteraction(interaction)) return;

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

    if (interaction.isButton() && (interaction.customId === 'btn_check_voicetime' || interaction.customId === 'btn_voice_leaderboard')) {
      console.log(`[DEBUG BUTTON] Button pressed: ${interaction.customId} by user ${interaction.user.tag} (${interaction.user.id})`);
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        console.log('[DEBUG BUTTON] deferReply successful');

        const dbTimes = await getCombinedVoiceTimes();

        if (interaction.customId === 'btn_check_voicetime') {
          const userId = interaction.user.id;
          const totalMinutes = dbTimes[userId] || 0;
          const hours = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;

          console.log(`[DEBUG BUTTON] Check time for ${userId}: ${totalMinutes} mins (${hours}h ${mins}m)`);

          const embed = new EmbedBuilder()
            .setColor(COLORS.info)
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setTitle('⏱️ สถิติเวลาออนห้องเสียงของคุณ')
            .addFields(
              { name: 'เวลาสะสมทั้งหมด', value: `**${hours} ชั่วโมง ${mins} นาที**`, inline: true }
            );

          await interaction.editReply({ embeds: [embed] });
          console.log('[DEBUG BUTTON] editReply for check_voicetime successful');
          return;
        }

        if (interaction.customId === 'btn_voice_leaderboard') {
          const sorted = Object.entries(dbTimes)
            .filter(([, m]) => m > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

          console.log('[DEBUG BUTTON] Leaderboard top 10 calculated, items:', sorted.length);

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
          console.log('[DEBUG BUTTON] editReply for voice_leaderboard successful');
          return;
        }
      } catch (error) {
        console.error('[DEBUG BUTTON ERROR] Catch block error:', error);
        await replyError(interaction, '❌ เกิดข้อผิดพลาดในการตรวจสอบเวลาออนเสียง');
        return;
      }
    }

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