/**
 * Auto-detects a brand icon URL from a service name/category.
 * Uses cdn.simpleicons.org for brand logos (free, no API key needed).
 * Falls back to a colored letter avatar if no brand matches.
 *
 * Usage:
 *   getServiceIcon(service.name, service.category, service.image_url)
 *   → { type: 'url', src: '...' }  or  { type: 'letter', letter: 'I', color: '#E1306C' }
 */

interface IconEntry {
  keywords: string[];
  slug: string;       // simpleicons.org slug
  color: string;      // hex without #
}

const BRAND_MAP: IconEntry[] = [
  { keywords: ['instagram', 'insta', 'ig '], slug: 'instagram', color: 'E1306C' },
  { keywords: ['facebook', ' fb ', 'fb likes', 'fb followers'], slug: 'facebook', color: '1877F2' },
  { keywords: ['tiktok', 'tik tok', 'tik-tok'], slug: 'tiktok', color: '010101' },
  { keywords: ['youtube', ' yt ', 'yt views', 'yt sub'], slug: 'youtube', color: 'FF0000' },
  { keywords: ['twitter', 'tweet', 'x followers', 'x likes', 'x views'], slug: 'x', color: '000000' },
  { keywords: ['telegram'], slug: 'telegram', color: '26A5E4' },
  { keywords: ['whatsapp', 'whats app', 'واتس'], slug: 'whatsapp', color: '25D366' },
  { keywords: ['snapchat', 'snap'], slug: 'snapchat', color: 'FFFC00' },
  { keywords: ['linkedin'], slug: 'linkedin', color: '0A66C2' },
  { keywords: ['pinterest'], slug: 'pinterest', color: 'E60023' },
  { keywords: ['reddit'], slug: 'reddit', color: 'FF4500' },
  { keywords: ['spotify'], slug: 'spotify', color: '1DB954' },
  { keywords: ['soundcloud'], slug: 'soundcloud', color: 'FF3300' },
  { keywords: ['discord'], slug: 'discord', color: '5865F2' },
  { keywords: ['twitch'], slug: 'twitch', color: '9146FF' },
  { keywords: ['threads'], slug: 'threads', color: '000000' },
  { keywords: ['clubhouse'], slug: 'clubhouse', color: '1B1B1B' },
  { keywords: ['vimeo'], slug: 'vimeo', color: '1AB7EA' },
  { keywords: ['dailymotion'], slug: 'dailymotion', color: '0D0D0D' },
  { keywords: ['twitch'], slug: 'twitch', color: '9146FF' },
  { keywords: ['shazam'], slug: 'shazam', color: '0088FF' },
  { keywords: ['apple music', 'itunes'], slug: 'applemusic', color: 'FC3C44' },
  { keywords: ['deezer'], slug: 'deezer', color: 'FF0092' },
  { keywords: ['tumblr'], slug: 'tumblr', color: '35465C' },
  { keywords: ['wechat', 'we chat', 'ويشات'], slug: 'wechat', color: '07C160' },
  { keywords: ['viber'], slug: 'viber', color: '7360F2' },
  { keywords: ['line app', 'line followers'], slug: 'line', color: '00C300' },
  { keywords: ['ok.ru', 'odnoklassniki'], slug: 'odnoklassniki', color: 'EE8208' },
  { keywords: ['vk ', 'vkontakte', 'vk likes'], slug: 'vk', color: '4376B8' },
  { keywords: ['kick '], slug: 'kick', color: '53FC18' },
  { keywords: ['rumble'], slug: 'rumble', color: '85C742' },
  { keywords: ['xena', 'yoho', 'yohoo', 'soulstar', 'soul star', 'game recharge', '🎮'], slug: '_game', color: '6366F1' },
];

const SIMPLE_ICONS_CDN = 'https://cdn.simpleicons.org';

type IconResult =
  | { type: 'url'; src: string; bgColor: string }
  | { type: 'letter'; letter: string; bgColor: string };

const cache = new Map<string, IconResult>();

export function getServiceIcon(
  name: string,
  category: string,
  imageUrl?: string | null,
): IconResult {
  // 1. Admin-set custom image takes priority
  if (imageUrl) return { type: 'url', src: imageUrl, bgColor: '111111' };

  const key = `${name}||${category}`;
  if (cache.has(key)) return cache.get(key)!;

  const haystack = `${name} ${category}`.toLowerCase();

  for (const entry of BRAND_MAP) {
    if (entry.keywords.some(kw => haystack.includes(kw.toLowerCase()))) {
      // _game = special case, no simpleicons slug
      const result: IconResult =
        entry.slug === '_game'
          ? { type: 'letter', letter: '🎮', bgColor: entry.color }
          : { type: 'url', src: `${SIMPLE_ICONS_CDN}/${entry.slug}/${entry.color}`, bgColor: entry.color + '22' };
      cache.set(key, result);
      return result;
    }
  }

  // Fallback: first letter of name + a deterministic color
  const fallbackColors = [
    '6366F1', 'EC4899', 'F59E0B', '10B981', '3B82F6',
    'EF4444', '8B5CF6', '06B6D4', 'F97316', '84CC16',
  ];
  const idx = name.charCodeAt(0) % fallbackColors.length;
  const result: IconResult = {
    type: 'letter',
    letter: name.charAt(0).toUpperCase(),
    bgColor: fallbackColors[idx],
  };
  cache.set(key, result);
  return result;
}
