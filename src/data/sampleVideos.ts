import { VideoItem } from '../types/video';

export const SAMPLE_VIDEOS: VideoItem[] = [
  {
    id: 'sample-big-buck-bunny',
    title: 'Big Buck Bunny',
    description: `A large, lovable rabbit encounters bullying forest creatures in this iconic open-source 3D animated short film produced by Blender Foundation.

Chapters:
00:00 Morning in the Forest
01:15 Awakening of the Bullies
02:30 The Pranks Begin
04:12 Big Buck Crafts the Trap
06:05 Retaliation & Forest Chase
08:20 The Flying Squirrel Showdown
09:15 Peaceful Meadow & Outro`,
    url: 'https://media.w3.org/2010/05/bunny/movie.mp4',
    poster: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-blender',
    author: 'Blender Foundation',
    views: 4820000,
    likes: 194000,
    dislikes: 1200,
    publishedAt: '2 months ago',
    duration: 596, // 09:56
    category: 'Animation',
    tags: ['Animation', 'Comedy', 'Open Source'],
    subtitlesUrl: ''
  },
  {
    id: 'sample-sintel',
    title: 'Sintel (Dragon Quest)',
    description: `A young nomad girl named Sintel rescues and bonds with a baby dragon whom she names Scales. When Scales is abducted, she embarks on a dangerous journey.

Chapters:
00:00 Desert Blizzard & Intro
00:15 The Memory of Scales
00:32 Mountain Ruins Confrontation
00:45 The Quest Continues`,
    url: 'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4',
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-blender',
    author: 'Durian Open Movie Team',
    views: 12400000,
    likes: 540000,
    dislikes: 3400,
    publishedAt: '4 months ago',
    duration: 52, // trailer sample
    category: 'Animation',
    tags: ['Fantasy', 'Action', 'Cinematic']
  },
  {
    id: 'sample-tears-of-steel',
    title: 'Tears of Steel',
    description: `Sci-fi post-apocalyptic VFX short film exploring a dystopian future in Amsterdam where scientists battle robotic organisms.

Chapters:
00:00 Amsterdam Under Siege
01:45 The Secret Bunker at Oude Kerk
03:20 Memory Capture & Holographic Calibration
05:10 Robot Sentry Breach
07:35 Emotional Reconciliation
09:50 Final Defense & Rocket Launch
11:20 Aftermath & Horizon`,
    url: 'https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-scifi',
    author: 'Mango Open Movie Team',
    views: 3150000,
    likes: 142000,
    dislikes: 950,
    publishedAt: '6 months ago',
    duration: 734, // 12:14
    category: 'Sci-Fi & VFX',
    tags: ['Sci-Fi', 'VFX', 'Cyberpunk']
  },
  {
    id: 'sample-elephants-dream',
    title: 'Elephants Dream',
    description: `The world's first open-source computer-animated film exploring surreal machinery, cables, and human perception.

Chapters:
00:00 Entering the Endless Machine
01:25 Proog's Explanation
03:10 The Bridge of Living Wires
05:40 Emo's Skepticism & Disruption
07:55 The Machine Awakens
09:40 The Final Stand`,
    url: 'https://archive.org/download/ElephantsDream/ed_hd.mp4',
    poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-openfilm',
    author: 'Orange Open Movie Project',
    views: 2100000,
    likes: 88000,
    dislikes: 1100,
    publishedAt: '1 year ago',
    duration: 653, // 10:53
    category: 'Documentary',
    tags: ['Surreal', '3D CGI', 'Classic']
  },
  {
    id: 'sample-for-bigger-blazes',
    title: 'Chromecast Nature: Blazes',
    description: 'High-definition showcase capturing dramatic campfire embers, thermal lighting, and glowing night outdoor ambiance.',
    url: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4',
    poster: 'https://images.unsplash.com/photo-1525972385311-b1e06ff4e815?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-nature',
    author: 'Google Demo Reel',
    views: 640000,
    likes: 31000,
    dislikes: 180,
    publishedAt: '3 weeks ago',
    duration: 15,
    category: 'Nature & Wildlife',
    tags: ['Nature', 'Atmospheric', 'Demo']
  },
  {
    id: 'sample-for-bigger-escapes',
    title: 'Chromecast Nature: Escapes',
    description: 'Vivid scenic exploration highlighting high alpine waterways, rushing mountain streams, and majestic wilderness landscapes.',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    poster: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
    channelId: 'channel-nature',
    author: 'Google Demo Reel',
    views: 890000,
    likes: 48000,
    dislikes: 210,
    publishedAt: '1 week ago',
    duration: 15,
    category: 'Nature & Wildlife',
    tags: ['Landscape', 'Outdoors', 'Ultra HD']
  }
];
