import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { supabase } from '../utils/supabase.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sync_history')
    .setDescription('ประมวลผล Log ห้องเสียงย้อนหลังและบันทึกเวลาลง Supabase'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบเท่านั้นที่ใช้คำสั่งนี้ได้ครับ!', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const logChannel = interaction.guild.channels.cache.find(c => c.name.includes('log-ห้องเสียง') || c.name.includes('เสียง'));
      
      if (!logChannel) {
        return interaction.editReply('❌ ไม่พบห้อง log-ห้องเสียง ในเซิร์ฟเวอร์นี้');
      }

      // เวลาเริ่มต้น: 21 พฤศจิกายน 2569 12:00 น.
      const startTime = new Date(2026, 10, 21, 12, 0, 0).getTime();

      await interaction.editReply(`🔄 กำลังกวาดและประมวลผลข้อความย้อนหลังตั้งแต่ 21 พ.ย. 2569...`);

      let messages = [];
      let lastId = null;
      let fetching = true;

      while (fetching) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetched = await logChannel.messages.fetch(options);
        if (fetched.size === 0) break;

        const fetchedArray = Array.from(fetched.values());
        for (const msg of fetchedArray) {
          if (msg.createdTimestamp < startTime) {
            fetching = false;
            break;
          }
          messages.push(msg);
        }

        lastId = fetchedArray[fetchedArray.length - 1].id;
        if (fetchedArray.length < 100) break;
      }

      const userMinutes = {}; 
      const activeJoins = {}; 

      messages.reverse(); // เรียงจากเก่าไปใหม่

      let parsedCount = 0;
      for (const msg of messages) {
        let contentText = msg.content || '';
        let embedText = '';
        
        if (msg.embeds.length > 0) {
          const embed = msg.embeds[0];
          embedText = `${embed.title || ''} ${embed.description || ''} ${embed.fields.map(f => f.name + ' ' + f.value).join(' ')}`;
        }

        const fullText = `${contentText} ${embedText}`;

        // ค้นหา User ID จากข้อความ (รองรับทั้งแบบ Mention <@ID> และแบบเก็บ ID ตรงๆ)
        const matchUser = fullText.match(/<@!?(\d+)>|(\d{17,19})/);
        if (!matchUser) continue;
        
        // กรองหาไอดีผู้ใช้ (เลือกตัวเลขที่น่าจะเป็น User ID)
        const userId = matchUser[1] || matchUser[2];
        if (!userId) continue;

        const msgTime = msg.createdTimestamp;

        // ตรวจจับคำว่า เข้า หรือ ออก
        const isJoin = /เข้า|join|connected|add/i.test(fullText);
        const isLeave = /ออก|leave|disconnected|move|switch/i.test(fullText);

        if (isJoin && !isLeave) {
          activeJoins[userId] = msgTime;
          parsedCount++;
        } else if (isLeave && activeJoins[userId]) {
          const durationMins = Math.floor((msgTime - activeJoins[userId]) / 60000);
          if (durationMins > 0 && durationMins < 1440) {
            userMinutes[userId] = (userMinutes[userId] || 0) + durationMins;
          }
          delete activeJoins[userId];
          parsedCount++;
        }
      }

      // บันทึกลง Supabase
      let successCount = 0;
      for (const [userId, totalMinutes] of Object.entries(userMinutes)) {
        if (totalMinutes <= 0) continue;

        const { data: existing } = await supabase
          .from('voice_times')
          .select('minutes')
          .eq('user_id', userId)
          .single();

        const baseMins = existing ? existing.minutes : 0;
        const finalMins = baseMins + totalMinutes;

        const { error } = await supabase
          .from('voice_times')
          .upsert({ user_id: userId, minutes: finalMins, updated_at: new Date() }, { onConflict: ['user_id'] });

        if (!error) successCount++;
      }

      await interaction.editReply(`✅ ประมวลผลสำเร็จ! กวาดข้อความ ${messages.length} ข้อความ (จับคู่เหตุการณ์ได้ ${parsedCount} รายการ) และอัปเดตลง Supabase ให้สมาชิก **${successCount} คน** เรียบร้อยแล้วครับ!`);

    } catch (error) {
      console.error('Sync History Error:', error);
      await interaction.editReply('❌ เกิดข้อผิดพลาดในการประมวลผลประวัติย้อนหลัง');
    }
  },
};