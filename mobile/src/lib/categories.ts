export interface StreamCategory {
  id: string;
  label: string;
  tag: string;
  badge: string;
  icon: string;
  keywords: string[];
}

export const STREAM_CATEGORIES: StreamCategory[] = [
  {
    id: 'gaming',
    label: 'Gaming',
    tag: '[Gaming]',
    badge: 'Gaming',
    icon: '●',
    keywords: ['gaming', 'game', 'play', 'minecraft', 'valorant', 'gta', 'fortnite', 'esports', 'apex', 'roblox', 'cod'],
  },
  {
    id: 'tech',
    label: 'Tech & Dev',
    tag: '[Tech]',
    badge: 'Tech & Dev',
    icon: '●',
    keywords: ['tech', 'coding', 'code', 'dev', 'developer', 'ai', 'software', 'programming', 'python', 'react', 'web', 'agent'],
  },
  {
    id: 'chat',
    label: 'Just Chatting',
    tag: '[Chat]',
    badge: 'Just Chatting',
    icon: '●',
    keywords: ['chat', 'just chatting', 'q&a', 'talk', 'chill', 'irl', 'discussion', 'podcast'],
  },
  {
    id: 'music',
    label: 'Music & Audio',
    tag: '[Music]',
    badge: 'Music',
    icon: '●',
    keywords: ['music', 'song', 'guitar', 'piano', 'beats', 'audio', 'dj', 'singing', 'lofi'],
  },
  {
    id: 'creative',
    label: 'Creative & Design',
    tag: '[Creative]',
    badge: 'Creative',
    icon: '●',
    keywords: ['creative', 'design', 'art', 'draw', 'drawing', 'figma', 'ui', 'ux', '3d', 'animation', 'blender'],
  },
];

export const FILTER_CATEGORIES = [
  { id: 'all', label: 'All Streams', icon: '●' },
  ...STREAM_CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon })),
];

export function getStreamCategory(title: string | undefined): StreamCategory | null {
  if (!title) return null;
  const lower = title.toLowerCase().trim();

  // 1. Tag matching: [Gaming], [Tech], [Chat], [Music], [Creative]
  for (const cat of STREAM_CATEGORIES) {
    if (lower.startsWith(cat.tag.toLowerCase()) || lower.includes(cat.tag.toLowerCase())) {
      return cat;
    }
  }

  // 2. Keyword fallback matching
  for (const cat of STREAM_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (lower.includes(kw)) {
        return cat;
      }
    }
  }

  return null;
}

export function cleanStreamTitle(title: string | undefined): string {
  if (!title) return '';
  return title.replace(/^\[(Gaming|Tech|Chat|Music|Creative|Live)\]\s*/i, '').trim() || title;
}
