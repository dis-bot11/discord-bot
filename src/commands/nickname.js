import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { desiredNickname } from '../nickname.js';
import { requireAdmin } from '../permissions.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_PER_RUN = 300;

export default {
  data: new SlashCommandBuilder()
    .setName('จัดชื่อแฟม')
    .setDescription('ตั้งชื่อเล่นสมาชิกทุกคนเป็น [แท็กแฟม] ชื่อ (เฉพาะผู้ดูแล)')
    .addBooleanOption((o) =>
      o.setName('ทดสอบ').setDescription('ใส่ true = แค่แสดงตัวอย่าง ยังไม่เปลี่ยนชื่อจริง (แนะนำให้ลองก่อน)'),
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const dryRun = interaction.options.getBoolean('ทดสอบ') ?? false;
    let already = 0;
    let skipped = 0;
    let changed = 0;
    let failed = 0;
    const samples = [];
    const todo = [];

    for (const member of interaction.guild.members.cache.values()) {
      if (member.user.bot) continue;
      const nick = desiredNickname(member);
      if (member.nickname === nick) already += 1;
      else if (!member.manageable) skipped += 1; // เจ้าของเซิร์ฟเวอร์ หรือยศสูงกว่าบอท
      else todo.push({ member, nick });
    }

    const batch = todo.slice(0, MAX_PER_RUN);
    for (const { member, nick } of batch) {
      if (samples.length < 8) samples.push(`${member.displayName} ➜ ${nick}`);
      if (dryRun) continue;
      try {
        await member.setNickname(nick, `จัดชื่อตามแท็กแฟม (สั่งโดย ${interaction.user.tag})`);
        changed += 1;
        await wait(300);
      } catch {
        failed += 1;
      }
    }

    const lines = [
      dryRun ? `🔎 **โหมดทดสอบ** (ยังไม่ได้เปลี่ยนชื่อจริง) แท็ก [${config.familyTag}]` : `✅ จัดชื่อเสร็จแล้ว แท็ก [${config.familyTag}]`,
      `${dryRun ? 'จะเปลี่ยน' : 'เปลี่ยนแล้ว'}: ${dryRun ? batch.length : changed} คน`,
      `ถูกต้องอยู่แล้ว: ${already} คน`,
      `ข้าม (บอทแก้ชื่อไม่ได้ เช่น เจ้าของเซิร์ฟเวอร์/ยศสูงกว่าบอท): ${skipped} คน`,
    ];
    if (failed) lines.push(`ล้มเหลว: ${failed} คน`);
    if (todo.length > batch.length) lines.push(`เหลืออีก ${todo.length - batch.length} คน สั่งใหม่อีกครั้งเพื่อทำต่อ`);
    if (samples.length) lines.push('', '**ตัวอย่าง**', ...samples);

    await interaction.editReply({ content: lines.join('\n'), allowedMentions: { parse: [] } });
  },
};
