import { 
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, 
  TextInputBuilder, TextInputStyle, EmbedBuilder, MessageFlags 
} from 'discord.js';

// 📌 Channel ID ของห้องสมาชิกแต่ละระดับ
const MEMBER_LOG_CHANNELS = {
  1: '1573226301274202203',
  2: '1573226354047062066',
  3: '1573226434313326602'
};

const ADMIN_LOG_CHANNEL_ID = ''; 

// 📌 Role ID ทั้ง 7 ระดับ
const PUNISH_ROLES = {
  '1_1': '1573541156115976313',
  '1_2': '1573543047164198923',
  '1_3': '1573543199325028412',
  '2_1': '1573543641065197690',
  '2_2': '1573544686709112954',
  '2_3': '1573543725466918962',
  '3_1': '1573543522307678401'
};

export function getModerationPanelComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mod_btn_1').setLabel('⚖️ ลงโทษระดับ 1 (ตักเตือน)').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('mod_btn_2').setLabel('🚨 ลงโทษระดับ 2 (คาดโทษ/พักใช้)').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mod_btn_3').setLabel('⛔ ลงโทษระดับ 3 (ขั้นเด็ดขาด/แบน)').setStyle(ButtonStyle.Danger),
  );
  return [row];
}

export async function handleModerationButtons(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith('mod_btn_')) return false;

  const level = interaction.customId.replace('mod_btn_', '');
  const modal = new ModalBuilder().setCustomId(`mod_modal_${level}`).setTitle(`ระบบลงโทษระดับ ${level} - แฟมสุภาพสตรี`);

  const targetInput = new TextInputBuilder().setCustomId('target_id').setLabel('Discord ID หรือ Mention ผู้ที่ต้องโดนลงโทษ').setPlaceholder('เช่น 123456789012345678').setStyle(TextInputStyle.Short).setRequired(true);
  const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('เหตุผล / รายละเอียดความผิด').setPlaceholder('ระบุพฤติกรรมที่ทำผิด...').setStyle(TextInputStyle.Paragraph).setRequired(true);
  const partnerInput = new TextInputBuilder().setCustomId('partner').setLabel('คู่กรณี (ถ้ามี - ถ้าไม่มีเว้นว่างได้)').setPlaceholder('ชื่อหรือไอดีคู่กรณี').setStyle(TextInputStyle.Short).setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(targetInput),
    new ActionRowBuilder().addComponents(reasonInput),
    new ActionRowBuilder().addComponents(partnerInput)
  );

  await interaction.showModal(modal);
  return true;
}

export async function handleModerationSubmit(interaction) {
  if (!interaction.isModalSubmit()) return false;
  if (!interaction.customId.startsWith('mod_modal_')) return false;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const level = interaction.customId.replace('mod_modal_', '');
  const targetInput = interaction.fields.getTextInputValue('target_id').replace(/[<@!>]/g, '');
  const reason = interaction.fields.getTextInputValue('reason');
  const partner = interaction.fields.getTextInputValue('partner') || 'ไม่มีคู่กรณี';

  try {
    const targetMember = await interaction.guild.members.fetch(targetInput).catch(() => null);
    if (!targetMember) {
      return await interaction.editReply({ content: '❌ ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์ กรุณาตรวจสอบ ID อีกครั้ง' });
    }

    let times = 1;
    if (level === '1') {
      if (targetMember.roles.cache.has(PUNISH_ROLES['1_2'])) times = 3;
      else if (targetMember.roles.cache.has(PUNISH_ROLES['1_1'])) times = 2;
    } else if (level === '2') {
      if (targetMember.roles.cache.has(PUNISH_ROLES['2_2'])) times = 3;
      else if (targetMember.roles.cache.has(PUNISH_ROLES['2_1'])) times = 2;
    } else if (level === '3') {
      times = 1;
    }

    let punishmentText = '';
    let timeoutDuration = 0;

    // 📌 ปรับระยะเวลาให้อยู่ภายในลิมิตของ Discord (สูงสุดไม่เกิน 28 วัน / กำหนดไว้ปลอดภัยที่ 7 และ 27 วัน)
    if (level === '1') {
      if (times === '1') {
        timeoutDuration = 1 * 60 * 60 * 1000; // 1 ชั่วโมง
        punishmentText = 'หมดเวลา (Timeout) 1 ชั่วโมง + ติดยศ [⚠️ เตือนระดับ 1]';
      } else if (times === '2') {
        timeoutDuration = 24 * 60 * 60 * 1000; // 1 วัน
        punishmentText = 'หมดเวลา (Timeout) 1 วัน + ติดยศ [⚠️ เตือนระดับ 2]';
      } else {
        timeoutDuration = 7 * 24 * 60 * 60 * 1000; // 7 วัน
        punishmentText = 'หมดเวลา (Timeout) 7 วัน + ติดยศ [⚠️ เตือนระดับ 3]';
      }
    } else if (level === '2') {
      if (times === '1') {
        timeoutDuration = 3 * 24 * 60 * 60 * 1000; // 3 วัน
        punishmentText = 'หมดเวลา (Timeout) 3 วัน + ติดยศ [🚨 คาดโทษระดับ 1]';
      } else if (times === '2') {
        timeoutDuration = 7 * 24 * 60 * 60 * 1000; // 7 วัน
        punishmentText = 'หมดเวลา (Timeout) 7 วัน + ติดยศ [🚨 คาดโทษระดับ 2]';
      } else {
        timeoutDuration = 27 * 24 * 60 * 60 * 1000; // 27 วัน (ไม่เกินลิมิต 28 วันของ Discord)
        punishmentText = 'หมดเวลา (Timeout) 27 วัน + ติดยศ [🚨 คาดโทษระดับ 3]';
      }
    } else if (level === '3') {
      punishmentText = 'เตะออกนอกเซิร์ฟเวอร์ (Kick) หรือแบนถาวรทันที + ติดยศ [⛔ ขั้นเด็ดขาด]';
    }

    // ทำการ Timeout สมาชิก (เฉพาะระดับ 1 และ 2)
    if (timeoutDuration > 0 && level !== '3') {
      await targetMember.timeout(timeoutDuration, `ลงโทษระดับ ${level} (ครั้งที่ ${times}): ${reason}`);
    }

    // แจกยศใหม่ตาม Role ID (คงยศเดิมไว้)
    const roleKey = `${level}_${times}`;
    const roleIdToAssign = PUNISH_ROLES[roleKey];
    if (roleIdToAssign) {
      await targetMember.roles.add(roleIdToAssign).catch((err) => console.error("แจกยศไม่สำเร็จ:", err));
    }

    // หากเป็นระดับ 3 ให้ทำการ Kick ออกจากเซิร์ฟเวอร์
    if (level === '3') {
      await targetMember.kick(`ลงโทษขั้นเด็ดขาด: ${reason}`).catch(() => {});
    }

    // สร้างการ์ด Embed สำหรับห้องสมาชิก
    const memberEmbed = new EmbedBuilder()
      .setColor(level === '1' ? '#FEE75C' : level === '2' ? '#EB459E' : '#ED4245')
      .setTitle(`🛡️ [บันทึกประวัติการลงโทษ - ระดับ ${level}]`)
      .setDescription('━━━━━━━━━━━━━━━━━━━━━━')
      .addFields(
        { name: '👤 ผู้ถูกลงโทษ', value: `<@${targetMember.id}> (ID: \`${targetMember.id}\`)`, inline: false },
        { name: '⚖️ ระดับความผิด', value: `ระดับ ${level} (กระทำความผิดครั้งที่ ${times})`, inline: false },
        { name: '📌 บทลงโทษที่ได้รับ', value: punishmentText, inline: false },
        { name: '📝 เหตุผล / รายละเอียด', value: reason, inline: false },
        { name: '👥 คู่กรณี', value: partner, inline: false },
        { name: '🛡️ ผู้ดำเนินการ (แอดมิน)', value: `<@${interaction.user.id}>`, inline: false },
        { name: '📅 วันที่ / เวลา', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: 'Fam System • Public Log' })
      .setTimestamp();

    // 1. ส่งเข้าห้อง Log ฝั่งสมาชิก
    const memberLogChannelId = MEMBER_LOG_CHANNELS[level];
    const memberLogChannel = interaction.guild.channels.cache.get(memberLogChannelId);
    if (memberLogChannel) {
      await memberLogChannel.send({ embeds: [memberEmbed] });
    }

    // 2. ส่งเข้าห้อง Log ฝั่งแอดมิน
    const adminLogChannel = (ADMIN_LOG_CHANNEL_ID ? interaction.guild.channels.cache.get(ADMIN_LOG_CHANNEL_ID) : null) || 
                            interaction.guild.channels.cache.find(c => c.name === 'log-แอดมิน');
    if (adminLogChannel) {
      const adminEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🔒 [ADMIN LOG] บันทึกการปฏิบัติงานลงโทษ`)
        .setDescription(`แอดมิน <@${interaction.user.id}> ได้ทำการลงโทษสมาชิก <@${targetMember.id}>`)
        .addFields(
          { name: 'ระดับโทษ', value: `ระดับ ${level} (ครั้งที่ ${times})`, inline: true },
          { name: 'ยศที่ได้รับ ID', value: roleIdToAssign || 'ไม่มีการเปลี่ยนยศ', inline: true },
          { name: 'เหตุผล', value: reason, inline: false }
        )
        .setTimestamp();
      await adminLogChannel.send({ embeds: [adminEmbed] });
    }

    await interaction.editReply({ content: `✅ ดำเนินการลงโทษสมาชิกเรียบร้อย (นับเป็นครั้งที่ ${times}) แอดรอยศและบันทึก Log สำเร็จ!` });

  } catch (error) {
    console.error(error);
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการประมวลผลบทลงโทษ' });
  }

  return true;
}