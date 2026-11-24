import adminAnnouncePanel from './adminAnnouncePanel.js';
import adminMemberPanel from './adminMemberPanel.js';
import adminPunishPanel from './adminPunishPanel.js';
import adminSecurityPanel from './adminSecurityPanel.js';
import announce from './announce.js';
import ban from './ban.js';
import chart from './chart.js';
import history from './history.js';
import nickname from './nickname.js';
import notice from './notice.js';
import pinChart from './pinChart.js';
import punish from './punish.js';
import reactionRole from './reactionRole.js';
import roles from './roles.js';
import unban from './unban.js';
import botguard from './botguard.js';
import setupVoicePanel from './setupVoicePanel.js';
import setupLeaderboard from './setupLeaderboard.js';

export const commands = [
  chart, 
  pinChart, 
  announce, 
  notice, 
  punish, 
  ban, 
  unban, 
  history, 
  roles, 
  nickname, 
  reactionRole,
  adminAnnouncePanel,
  adminMemberPanel,
  adminSecurityPanel,
  adminPunishPanel,
  botguard,
  setupVoicePanel,
  setupLeaderboard
];

export const byName = new Map(commands.map((c) => [c.data.name, c]));
export const byPrefix = new Map(commands.filter((c) => c.prefix).map((c) => [c.prefix, c]));