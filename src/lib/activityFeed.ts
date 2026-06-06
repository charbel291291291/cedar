// ─── Activity Feed Engine ─────────────────────────────────────────────────────
// Mixes real Supabase Realtime orders with smart fake activity notifications.
// Designed for conversion psychology: urgency, social proof, FOMO.

export type ActivityKind = 'purchase' | 'topup' | 'milestone' | 'active';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  name: string;
  service: string;
  amount?: number;
  timeLabel: string;
  emoji: string;
  /** true = came from real DB event */
  isReal: boolean;
}

// ── Name pools ────────────────────────────────────────────────────────────────
const MASKED  = ['A***','M***','S***','K***','R***','O***','L***','N***','H***','D***','T***','J***'];
const FIRST   = ['Ahmad','Mohammad','Sara','Karim','Rania','Omar','Layla','Nour','Hassan','Dana','Charbel','Maya','Tarek','Lara','Ali','Ziad','Hana','Fadi','Rana','Jad'];

// ── Service pools ─────────────────────────────────────────────────────────────
export const FAKE_SERVICES = [
  { label: 'Instagram Followers', emoji: '📸' },
  { label: 'Instagram Likes',     emoji: '❤️' },
  { label: 'TikTok Views',        emoji: '🎵' },
  { label: 'TikTok Followers',    emoji: '🎵' },
  { label: 'YouTube Views',       emoji: '▶️' },
  { label: 'YouTube Subscribers', emoji: '▶️' },
  { label: 'Facebook Likes',      emoji: '👍' },
  { label: 'Facebook Followers',  emoji: '👍' },
  { label: 'Telegram Members',    emoji: '✈️' },
  { label: 'Twitter Followers',   emoji: '🐦' },
  { label: 'Snapchat Views',      emoji: '👻' },
  { label: 'Wallet Top-up',       emoji: '💰' },
];

const PURCHASE_VERBS = ['just bought','just ordered','purchased','just got','boosted with'];
const TOPUP_AMOUNTS  = [10, 20, 25, 50, 100];

const MILESTONE_MSGS = [
  { text: '3 users purchased in the last 10 minutes', emoji: '🔥' },
  { text: '12 orders completed today',                emoji: '📦' },
  { text: '5 people are viewing SMM Engine right now',emoji: '👁️' },
  { text: 'Most popular: Instagram Followers boost',  emoji: '🏆' },
  { text: '24 orders in the last hour',               emoji: '⚡' },
  { text: 'New users joining every minute',           emoji: '🚀' },
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function uid(): string { return Math.random().toString(36).slice(2, 9); }

function randomName(): string {
  // 30% chance show real first name, 70% masked
  return Math.random() < 0.30 ? pick(FIRST) : pick(MASKED);
}

function timeLabel(secondsAgo: number): string {
  if (secondsAgo < 60)  return 'just now';
  if (secondsAgo < 120) return '1 min ago';
  return `${Math.floor(secondsAgo / 60)} min ago`;
}

// ── Fake notification generator ───────────────────────────────────────────────
export function generateFakeActivity(): ActivityItem {
  const roll = Math.random();

  // 15% chance: milestone message
  if (roll < 0.15) {
    const m = pick(MILESTONE_MSGS);
    return {
      id: uid(), kind: 'milestone', name: '', service: m.text,
      timeLabel: timeLabel(Math.random() * 300 + 30),
      emoji: m.emoji, isReal: false,
    };
  }

  // 10% chance: wallet top-up
  if (roll < 0.25) {
    const amount = pick(TOPUP_AMOUNTS);
    return {
      id: uid(), kind: 'topup', name: randomName(),
      service: `added $${amount} to their wallet`,
      amount, timeLabel: timeLabel(Math.random() * 120 + 10),
      emoji: '💰', isReal: false,
    };
  }

  // 75% chance: service purchase
  const svc = pick(FAKE_SERVICES.filter(s => s.label !== 'Wallet Top-up'));
  const verb = pick(PURCHASE_VERBS);
  return {
    id: uid(), kind: 'purchase', name: randomName(),
    service: `${verb} ${svc.label}`,
    timeLabel: timeLabel(Math.random() * 600 + 5),
    emoji: svc.emoji, isReal: false,
  };
}

// ── Convert real DB order to ActivityItem ─────────────────────────────────────
export function realOrderToActivity(order: {
  id: string;
  service_name?: string;
  created_at: string;
}): ActivityItem {
  const svc = FAKE_SERVICES.find(s =>
    order.service_name?.toLowerCase().includes(s.label.split(' ')[0].toLowerCase())
  ) ?? pick(FAKE_SERVICES);

  const secsAgo = Math.max(0, (Date.now() - new Date(order.created_at).getTime()) / 1000);
  return {
    id: order.id, kind: 'purchase', name: randomName(),
    service: `just ordered ${order.service_name ?? svc.label}`,
    timeLabel: timeLabel(secsAgo),
    emoji: svc.emoji, isReal: true,
  };
}

// ── Notification sound (Web Audio, no file needed) ────────────────────────────
export function playNotifSound(muted: boolean) {
  if (muted) return;
  try {
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ac.currentTime;
    [0, 0.1].forEach((d, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(i === 0 ? 880 : 1100, now + d);
      g.gain.setValueAtTime(0.04, now + d);
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.15);
      o.connect(g); g.connect(ac.destination);
      o.start(now + d); o.stop(now + d + 0.15);
    });
  } catch {}
}
