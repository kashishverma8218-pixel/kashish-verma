import { VideoItem } from '../types/video';

export const SAMPLE_VIDEOS: VideoItem[] = [
  {
    id: 'sample-big-buck-bunny',
    title: 'Big Buck Bunny',
    description: 'A large, lovable rabbit encounters bullying forest creatures in this iconic open-source 3D animated short film produced by Blender Foundation.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
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
    description: 'A young nomad girl named Sintel rescues and bonds with a baby dragon whom she names Scales. When Scales is abducted, she embarks on a dangerous journey.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
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
    description: 'Sci-fi post-apocalyptic VFX short film exploring a dystopian future in Amsterdam where scientists battle robotic organisms.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
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
    description: 'The world\'s first open-source computer-animated film exploring surreal machinery, cables, and human perception.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
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
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
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
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
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
