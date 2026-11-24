import { Events, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { config } from '../config.js';
import { COLORS, isOurGuild, sendLog } from '../logger.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    if (!isOurGuild(member.guild)) return;

    try {
      const guild = member.guild;
      const memberCount = guild.memberCount;

      // 1. สร้าง Canvas ขนาดตามสัดส่วนภาพ
      const canvas = createCanvas(1024, 500);
      const ctx = canvas.getContext('2d');

      // 2. โหลดรูปภาพพื้นหลัง
      const backgroundURL = 'https://cdn.discordapp.com/attachments/1459497211091222723/1573248864117592194/RASIA_.png?ex=6b0151ae&is=6b00002e&hm=b66a9d47dfb09f60990d49c44169f73c37a8af53e3b2317ea104fdc28fdb6a94&';
      const background = await loadImage(backgroundURL);
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

      // 3. วาดรูปโปรไฟล์สมาชิก (ตัดเป็นวงกลม)
      const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
      const avatar = await loadImage(avatarURL);
      
      const avatarX = 150;
      const avatarY = 250;
      const avatarRadius = 80;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.restore();

      // วาดกรอบวงแหวนรอบรูปโปรไฟล์ให้เด่นชัด
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius + 3, 0, Math.PI * 2, true);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // 4. ตั้งค่าเงาให้ตัวหนังสือคมชัด ไม่กลืนกับพื้นหลัง (Text Shadow)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;

      // WELCOME
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('WELCOME', 280, 190);

      // ชื่อสมาชิก (เปลี่ยนเป็นสีทองสว่าง ตัดกับพื้นหลังดาร์กๆ ได้เด่นสะใจที่สุด)
      ctx.fillStyle = '#f1c40f'; 
      ctx.font = 'bold 52px sans-serif';
      ctx.fillText(member.user.username, 280, 255);

      // ลำดับสมาชิก (สีขาวอมเทา สว่างอ่านง่าย)
      ctx.fillStyle = '#ecf0f1';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`YOU ARE THE ${memberCount}TH MEMBER`, 280, 305);

      // เคลียร์ค่า Shadow เพื่อไม่ให้กระทบส่วนอื่น
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 5. แปลงเป็นไฟล์ภาพเพื่อส่งเข้า Discord
      const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
        name: 'welcome-card.png',
      });

      // 6. ส่งเข้าห้องต้อนรับ (จัดรูปแบบเว้นวรรคไม่ให้กลืนกัน)
      const welcomeChannelId = config.channels.welcome || config.channels.voice;
      const welcomeChannel = guild.channels.cache.get(welcomeChannelId);

      if (welcomeChannel) {
        await welcomeChannel.send({
          content: `ยินดีต้อนรับสู่ **${guild.name}** ครับ ${member} 🎉\nขอให้สนุกกับพวกเรานะ!`,
          files: [attachment],
        });
      }

    } catch (err) {
      console.error('[Welcome Card Error]:', err);
    }
  },
};