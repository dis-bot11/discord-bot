import { config } from './config.js';

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ชื่อเล่นที่ควรเป็น: [สตรี] ชื่อ (ตัดแท็กซ้ำออกก่อน และไม่เกิน 32 ตัวอักษรตามที่ Discord กำหนด) */
export function desiredNickname(member) {
  const tagPrefix = new RegExp(`^(\\[${escapeRegExp(config.familyTag)}\\]\\s*)+`);
  const base = member.displayName.replace(tagPrefix, '').trim() || member.user.username;
  return `[${config.familyTag}] ${base}`.slice(0, 32);
}
