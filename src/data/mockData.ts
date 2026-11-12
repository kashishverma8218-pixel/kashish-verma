import { Channel, VideoItem, Comment, ReelItem, ReelComment } from '../types/video';

export const CHANNELS: Record<string, Channel> = {
  'channel-blender': {
    id: 'channel-blender',
    name: 'Blender Studio',
    handle: '@blenderstudio',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=250&q=80',
    banner: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1600&q=80',
    verified: true,
    subscribersCount: 2840000,
    isSubscribed: true,
    notificationBell: 'all',
    bio: 'Dedicated to creating open-source animated films and testing Blender production pipelines with international artists.',
    joinedDate: 'Joined Oct 14, 2011',
    videoCount: 142,
  },
  'channel-scifi': {
    id: 'channel-scifi',
    name: 'CyberVFX Labs',
    handle: '@cybervfxlabs',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
    banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80',
    verified: true,
    subscribersCount: 1420000,
    isSubscribed: false,
    notificationBell: 'none',
    bio: 'Groundbreaking visual effects, cybernetic worldbuilding, and futuristic short films pushed to the cutting edge.',
    joinedDate: 'Joined Jan 22, 2017',
    videoCount: 88,
  },
  'channel-nature': {
    id: 'channel-nature',
    name: 'Earth Cinema 4K',
    handle: '@earthcinema4k',
    avatar: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=250&q=80',
    banner: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
    verified: true,
    subscribersCount: 950000,
    isSubscribed: true,
    notificationBell: 'personalized',
    bio: 'Immersive nature documentaries capturing remote wilderness, alpine vistas, ocean depths, and wildlife in ultra-high fidelity.',
    joinedDate: 'Joined Mar 8, 2019',
    videoCount: 64,
  },
  'channel-openfilm': {
    id: 'channel-openfilm',
    name: 'Indie Cinema Collective',
    handle: '@indiecinemaco',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    banner: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80',
    verified: false,
    subscribersCount: 312000,
    isSubscribed: false,
    notificationBell: 'none',
    bio: 'Championing experimental narrative cinema, indie shorts, and creative open filmmaking worldwide.',
    joinedDate: 'Joined Aug 19, 2020',
    videoCount: 45,
  },
};

export const INITIAL_VIDEOS: VideoItem[] = [
  {
    id: 'video-bbb',
    title: 'Big Buck Bunny: The Open Animation Masterpiece',
    description: `A large, gentle woodland rabbit named Big Buck awakens to a sunny morning only to be harassed by three bullying forest pests: Frank the flying squirrel, Rinky the red squirrel, and Gimera the chinchilla. Watch how he devises clever comedic revenge!

Chapters:
00:00 Morning in the Forest
01:15 Awakening of the Bullies
02:30 The Pranks Begin
04:12 Big Buck Crafts the Trap
06:05 Retaliation & Forest Chase
08:20 The Flying Squirrel Showdown
09:15 Peaceful Meadow & Outro`,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    poster: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-blender',
    views: 4820000,
    likes: 194000,
    dislikes: 1200,
    publishedAt: '2 months ago',
    duration: 596,
    category: 'Animation',
    tags: ['Animation', 'Comedy', 'Open Source', 'Blender', '3D CGI'],
    isTrending: true,
  },
  {
    id: 'video-sintel',
    title: 'Sintel: The Dragon Quest — Official 4K Trailer',
    description: `A lonely young warrior girl named Sintel rescues and nurtures an injured baby dragon whom she names Scales. When her beloved companion is snatched by an adult dragon, she braves treacherous blizzards and subterranean ruins to win him back.

Chapters:
00:00 Desert Blizzard & Intro
00:15 The Memory of Scales
00:32 Mountain Ruins Confrontation
00:45 The Quest Continues`,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-blender',
    views: 12400000,
    likes: 540000,
    dislikes: 3400,
    publishedAt: '4 months ago',
    duration: 52,
    category: 'Animation',
    tags: ['Animation', 'Fantasy', 'Action', 'Cinematic', 'Dragon'],
    isTrending: true,
  },
  {
    id: 'video-tears-of-steel',
    title: 'Tears of Steel: Amsterdam Dystopian VFX Short',
    description: `Set in a dystopian future Amsterdam, a group of eccentric scientists and military personnel gather at the Oude Kerk to stage a crucial historical event in a desperate bid to rescue the world from marauding robotic sentinels.

Chapters:
00:00 Amsterdam Under Siege
01:45 The Secret Bunker at Oude Kerk
03:20 Memory Capture & Holographic Calibration
05:10 Robot Sentry Breach
07:35 Emotional Reconciliation
09:50 Final Defense & Rocket Launch
11:20 Aftermath & Horizon`,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-scifi',
    views: 3150000,
    likes: 142000,
    dislikes: 950,
    publishedAt: '6 months ago',
    duration: 734,
    category: 'Sci-Fi & VFX',
    tags: ['Sci-Fi', 'VFX', 'Cyberpunk', 'Robotics', 'Amsterdam'],
    isTrending: true,
  },
  {
    id: 'video-escapes',
    title: 'Ultra HD Escapes: Alpine Rivers & Glacial Valleys',
    description: `Take a restorative visual journey through untouched high alpine ecosystems, crystal-clear glacial streams, cascading waterfalls, and majestic evergreen ridges filmed in pristine Ultra High Definition.

Chapters:
00:00 Alpine Valley Sunrise
00:05 Crystal Glacial Stream
00:10 Ridge Pine Canopy`,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    poster: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-nature',
    views: 890000,
    likes: 48000,
    dislikes: 210,
    publishedAt: '1 week ago',
    duration: 15,
    category: 'Nature & Wildlife',
    tags: ['Nature', 'Relaxing', 'Mountains', 'Alpine', 'Water'],
    isTrending: false,
  },
  {
    id: 'video-elephants-dream',
    title: 'Elephants Dream: Surreal Machinery & Human Perception',
    description: `Two explorers, Proog and Emo, traverse an infinite labyrinthine mechanical world of living cables and clockwork machinery. Their conflicting visions of reality threaten to unravel the very world around them.

Chapters:
00:00 Entering the Endless Machine
01:25 Proog's Explanation
03:10 The Bridge of Living Wires
05:40 Emo's Skepticism & Disruption
07:55 The Machine Awakens
09:40 The Final Stand`,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-openfilm',
    views: 2100000,
    likes: 88000,
    dislikes: 1100,
    publishedAt: '1 year ago',
    duration: 653,
    category: 'Documentary',
    tags: ['Surreal', '3D CGI', 'Cables', 'Experimental'],
    isTrending: false,
  },
  {
    id: 'video-blazes',
    title: 'Chromecast Cinematic Night: Embers & Thermal Flame',
    description: 'High-contrast nocturnal cinematography capturing glowing embers, wood sparks dancing into the dark sky, and ambient fireside warmth filmed with cinema grade macro lenses.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1525972385311-b1e06ff4e815?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-nature',
    views: 640000,
    likes: 31000,
    dislikes: 180,
    publishedAt: '3 weeks ago',
    duration: 15,
    category: 'Nature & Wildlife',
    tags: ['Fire', 'Night', 'Cinematography', 'Macro'],
    isTrending: false,
  },
  {
    id: 'video-joyrides',
    title: 'High Speed Mountain Descent: Coastal Highway Joyride',
    description: 'Experience exhilarating sweeping turns along scenic cliffside highway corridors with dynamic camera mounts and engine roar.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-scifi',
    views: 1450000,
    likes: 72000,
    dislikes: 420,
    publishedAt: '5 days ago',
    duration: 15,
    category: 'Gaming & CGI',
    tags: ['Driving', 'Speed', 'Coastal', 'Cinematic'],
    isTrending: true,
  },
  {
    id: 'video-we-are-going',
    title: 'We Are Going On Bullrun: Adventure Travelogue',
    description: 'Behind the scenes documentary footage following an adventurous road rally through rugged backroads, dusty canyons, and historic landmarks across the continent.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    poster: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-openfilm',
    views: 780000,
    likes: 39000,
    dislikes: 240,
    publishedAt: '2 weeks ago',
    duration: 15,
    category: 'Documentary',
    tags: ['Travel', 'Rally', 'Road Trip', 'Documentary'],
    isTrending: false,
  },
];

export const INITIAL_COMMENTS: Record<string, Comment[]> = {
  'video-bbb': [
    {
      id: 'c-101',
      videoId: 'video-bbb',
      authorName: 'Alex Mercer',
      authorHandle: '@alexmercer_vfx',
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
      content: 'Can we just appreciate how revolutionary this was when it first released? The fur rendering and physics simulation laid the foundation for modern Blender character animation!',
      timestamp: '3 days ago',
      likes: 1240,
      userLiked: false,
      replies: [
        {
          id: 'rep-1',
          commentId: 'c-101',
          authorName: 'Blender Studio',
          authorHandle: '@blenderstudio',
          authorAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80',
          content: 'Thank you Alex! It was an incredible sprint testing the early particle systems.',
          timestamp: '2 days ago',
          likes: 412,
          userLiked: false,
        },
      ],
    },
    {
      id: 'c-102',
      videoId: 'video-bbb',
      authorName: 'Maya Lin',
      authorHandle: '@mayalin_design',
      authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
      content: 'The comedic timing of the trap mechanism at 05:10 never fails to make me laugh out loud. True slapstick genius.',
      timestamp: '1 week ago',
      likes: 850,
      userLiked: false,
    },
    {
      id: 'c-103',
      videoId: 'video-bbb',
      authorName: 'Devon Thorne',
      authorHandle: '@devonthorne',
      authorAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
      content: 'Still using this asset pack to benchmark GPU rendering on new workstation builds in 2026! Pure nostalgia.',
      timestamp: '2 weeks ago',
      likes: 314,
      userLiked: false,
    },
  ],
  'video-sintel': [
    {
      id: 'c-201',
      videoId: 'video-sintel',
      authorName: 'Elena Rostova',
      authorHandle: '@elena_cine',
      authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80',
      content: 'The emotional depth and that heartbreaking twist at the end... Sintel will forever be one of the greatest animated shorts ever conceived.',
      timestamp: '1 month ago',
      likes: 2180,
      userLiked: false,
    },
    {
      id: 'c-202',
      videoId: 'video-sintel',
      authorName: 'Marcus Vance',
      authorHandle: '@marcus_vance',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
      content: 'The orchestral soundtrack composed by Jan Morgenstern is pure cinema magic. Gives me goosebumps every single time.',
      timestamp: '2 weeks ago',
      likes: 642,
      userLiked: false,
    },
  ],
  'video-tears-of-steel': [
    {
      id: 'c-301',
      videoId: 'video-tears-of-steel',
      authorName: 'Cypher Null',
      authorHandle: '@cyphernull',
      authorAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=120&q=80',
      content: 'The match-moving tracking shots through real Amsterdam street architecture blended with robot tentacles was years ahead of its time.',
      timestamp: '5 days ago',
      likes: 920,
      userLiked: false,
    },
  ],
};

export const CATEGORIES = [
  'All',
  'Custom Feed',
  'Reels',
  'Trending',
  'Animation',
  'Sci-Fi & VFX',
  'Nature & Wildlife',
  'Gaming & CGI',
  'Documentary',
  'Recently Uploaded',
];

export function formatViews(views: number): string {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1).replace(/\.0$/, '')}M views`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(0)}K views`;
  }
  return `${views} views`;
}

export function formatFollowers(subs: number): string {
  if (subs >= 1000000) {
    return `${(subs / 1000000).toFixed(2).replace(/\.00$/, '')}M followers`;
  }
  if (subs >= 1000) {
    return `${(subs / 1000).toFixed(1).replace(/\.0$/, '')}K followers`;
  }
  return `${subs} followers`;
}

// Retain alias for existing callers
export const formatSubscribers = formatFollowers;

export const INITIAL_REELS: ReelItem[] = [
  {
    id: 'reel-1',
    title: 'The Squirrel Ambush 🐿️ Acorn Tactics',
    description: 'Frank and Rinky planning their aerial acorn strike! Pure animation gold from the open movie project. #blender #3danimation #reels',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    poster: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
    channelId: 'channel-blender',
    views: 1840000,
    likes: 94200,
    commentsCount: 1420,
    audioTrack: 'Original Sound - Blender Studio',
    audioArtist: 'Blender Studio',
    tags: ['Blender', 'Comedy', 'Animation', 'Reels'],
    userLiked: false,
    userSaved: false,
    createdAt: '1 day ago',
  },
  {
    id: 'reel-2',
    title: 'Cyber Sentinels VFX Breakdown ⚡ Robotic Tentacles',
    description: 'Live-action camera tracking with procedural mechanical simulation in Amsterdam streets. #cyberpunk #vfx #scifi #shortfilm',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    channelId: 'channel-scifi',
    views: 890000,
    likes: 62400,
    commentsCount: 840,
    audioTrack: 'Neon Pulse (Synthwave Mix)',
    audioArtist: 'CyberVFX Labs',
    tags: ['VFX', 'SciFi', 'CGI', 'Robotics'],
    userLiked: true,
    userSaved: true,
    createdAt: '3 days ago',
  },
  {
    id: 'reel-3',
    title: 'Pure Glacial Water 🏔️ Alpine Melt River in 4K',
    description: 'Crystalline streams descending through granite canyons at 2,400m elevation. Sound on for pure relaxation! 💧 #nature #mountains #calm #4k',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    poster: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
    channelId: 'channel-nature',
    views: 2450000,
    likes: 185000,
    commentsCount: 3120,
    audioTrack: 'Glacial Whispers - Ambient Soundscapes',
    audioArtist: 'Earth Cinema 4K',
    tags: ['Nature', 'Relaxing', 'Glacier', 'Water'],
    userLiked: false,
    userSaved: false,
    createdAt: '4 days ago',
  },
  {
    id: 'reel-4',
    title: 'Dragon Encounter 🐉 Sintel\'s Dangerous Journey',
    description: 'The cinematic confrontation in the snowy mountain caverns. Masterclass character design and lighting. #animation #fantasy #sintel',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    channelId: 'channel-blender',
    views: 3200000,
    likes: 241000,
    commentsCount: 4210,
    audioTrack: "The Dragon's Flight (Orchestral Theme)",
    audioArtist: 'Jan Morgenstern',
    tags: ['Animation', 'Fantasy', 'Story', 'Dragon'],
    userLiked: false,
    userSaved: false,
    createdAt: '1 week ago',
  },
  {
    id: 'reel-5',
    title: 'Thermal Embers Floating Into Midnight Sky 🔥',
    description: 'High frame-rate macro recording of glowing wood coals and dancing thermal currents. #embers #cinematography #macro',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1525972385311-b1e06ff4e815?auto=format&fit=crop&w=800&q=80',
    channelId: 'channel-nature',
    views: 980000,
    likes: 78000,
    commentsCount: 650,
    audioTrack: 'Crackling Campfire Audio',
    audioArtist: 'Earth Cinema 4K',
    tags: ['Fire', 'Night', 'Macro', 'Cinematic'],
    userLiked: false,
    userSaved: false,
    createdAt: '2 weeks ago',
  },
  {
    id: 'reel-6',
    title: 'Coastal Ridge Joyride 🏎️ Sweeping S-Curves',
    description: 'Dynamic chase cam footage tearing through scenic coastal highway passes. #racing #driving #speed #scenic',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    channelId: 'channel-scifi',
    views: 1120000,
    likes: 58000,
    commentsCount: 710,
    audioTrack: 'Apex Drive - High Octane Beat',
    audioArtist: 'Velocity Audio',
    tags: ['Driving', 'Speed', 'Reels', 'Action'],
    userLiked: false,
    userSaved: false,
    createdAt: '3 weeks ago',
  },
];

export const INITIAL_REEL_COMMENTS: Record<string, ReelComment[]> = {
  'reel-1': [
    {
      id: 'rc-1',
      reelId: 'reel-1',
      authorName: 'Alex Mercer',
      authorHandle: '@alexmercer_vfx',
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
      content: 'The comedic timing when Frank drops the giant acorn is unmatched 😂',
      timestamp: '5 hours ago',
      likes: 342,
      userLiked: false,
    },
    {
      id: 'rc-2',
      reelId: 'reel-1',
      authorName: 'Maya Lin',
      authorHandle: '@mayalin_design',
      authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
      content: 'Can not believe this was created completely in open source Blender!',
      timestamp: '1 day ago',
      likes: 128,
      userLiked: false,
    },
  ],
  'reel-2': [
    {
      id: 'rc-3',
      reelId: 'reel-2',
      authorName: 'Cypher Null',
      authorHandle: '@cyphernull',
      authorAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=120&q=80',
      content: 'The reflections of the neon signs on the wet asphalt are insanely detailed.',
      timestamp: '2 days ago',
      likes: 215,
      userLiked: true,
    },
  ],
  'reel-3': [
    {
      id: 'rc-4',
      reelId: 'reel-3',
      authorName: 'Sarah Jenkins',
      authorHandle: '@sarahj_art',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      content: 'Watching this on repeat after a stressful workday. Such pure serenity.',
      timestamp: '3 days ago',
      likes: 540,
      userLiked: false,
    },
  ],
};

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    type: 'upload' as const,
    title: 'New Video Uploaded',
    message: 'Blender Studio uploaded: Big Buck Bunny: The Open Animation Masterpiece',
    timestamp: '2 hours ago',
    createdAt: Date.now() - 7200000,
    read: false,
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=300&q=80',
    videoId: 'video-bbb',
    channelId: 'channel-blender',
  },
  {
    id: 'notif-2',
    type: 'upload' as const,
    title: 'New Premiere',
    message: 'Earth Cinema 4K premiered: Ultra HD Escapes: Alpine Rivers & Glacial Valleys',
    timestamp: '5 hours ago',
    createdAt: Date.now() - 18000000,
    read: false,
    avatar: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=120&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=300&q=80',
    videoId: 'video-escapes',
    channelId: 'channel-nature',
  },
  {
    id: 'notif-3',
    type: 'reply' as const,
    title: 'New Comment Reply',
    message: 'Elena Rostova replied to your comment on "Sintel: The Dragon Quest"',
    timestamp: 'Yesterday',
    createdAt: Date.now() - 86400000,
    read: false,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=300&q=80',
    videoId: 'video-sintel',
  },
  {
    id: 'notif-4',
    type: 'milestone' as const,
    title: 'Creator Milestone Reached!',
    message: 'Congratulations! Your channel reached 150 followers. Keep up the great storytelling!',
    timestamp: '2 days ago',
    createdAt: Date.now() - 172800000,
    read: true,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    linkText: 'View Creator Studio',
  },
  {
    id: 'notif-5',
    type: 'subscription' as const,
    title: 'New Channel Follower',
    message: 'Marcus Vance (@marcus_vance) started following your channel.',
    timestamp: '3 days ago',
    createdAt: Date.now() - 259200000,
    read: true,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
  },
];


