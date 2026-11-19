import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AppLanguage = 'en' | 'hi' | 'hinglish' | 'es';

export interface LanguageOption {
  code: AppLanguage;
  label: string;
  nativeLabel: string;
  shortCode: string;
}

export const APP_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', shortCode: 'EN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', shortCode: 'हिं' },
  { code: 'hinglish', label: 'Hinglish', nativeLabel: 'Hinglish', shortCode: 'HG' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', shortCode: 'ES' },
];

export const CONTENT_LANGUAGES = [
  'Hindi',
  'English',
  'Hinglish',
  'Punjabi',
  'Tamil',
  'Telugu',
  'Marathi',
  'Bengali',
  'Bhojpuri',
  'Spanish',
  'Japanese',
  'Other',
];

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.reels': 'Shorts & Reels',
    'nav.reelsShort': 'Reels',
    'nav.following': 'Following',
    'nav.you': 'You',
    'nav.history': 'History',
    'nav.watchLater': 'Watch later',
    'nav.playlists': 'Playlists',
    'nav.likedVideos': 'Liked videos',
    'nav.studio': 'Creator Studio',
    'nav.studioShort': 'Studio',
    'nav.explore': 'Explore',
    'nav.trending': 'Trending',
    'nav.customFeed': 'Custom Feed',
    'nav.settings': 'Settings',
    'nav.videoFilters': 'Video Filters',
    'nav.shortcuts': 'Keyboard Shortcuts',
    'nav.create': 'Create',
    'nav.searchPlaceholder': 'Search',
    'nav.searchVio': 'Search Vio streaming',
    'nav.signIn': 'Sign in',
    'nav.signOut': 'Sign Out',
    'nav.language': 'Language',
    'nav.appearance': 'Appearance',
    'home.shortsAndReels': 'Reels',
    'home.viewAll': 'View all',
    'home.noMatchingVideos': 'No matching videos found',
    'home.tryAnother': 'Try another search query or category.',
    'home.trendingTitle': 'Trending on Vio streaming',
    'home.trendingSubtitle': 'The most watched animations, gaming clips, and high-definition reels right now',
    'cat.All': 'All',
    'cat.Custom Feed': 'Custom Feed',
    'cat.Reels': 'Reels',
    'cat.Trending': 'Trending',
    'cat.Gaming': 'Gaming',
    'cat.Animation': 'Animation',
    'cat.Sci-Fi & VFX': 'Sci-Fi & VFX',
    'cat.Nature & Wildlife': 'Nature & Wildlife',
    'cat.Gaming & CGI': 'Gaming & CGI',
    'cat.Documentary': 'Documentary',
    'cat.Music': 'Music',
    'cat.Education': 'Education',
    'cat.Recently Uploaded': 'Recently Uploaded',
    'studio.dashboard': 'Dashboard',
    'studio.content': 'Content Manager',
    'studio.analytics': 'Channel Analytics',
    'studio.hlsMetrics': 'HLS Telemetry',
    'studio.monetization': 'Monetization (Earn)',
    'studio.colorLab': 'Color & Framing Lab',
    'studio.comments': 'Comments',
    'studio.branding': 'Branding',
    'studio.uploadVideo': 'Upload Video',
    'monetization.title': 'Creator Monetization & Partner Program',
    'monetization.subtitle': 'Track YouTube-style eligibility, ad revenue streams, memberships & 30/70 payouts',
    'monetization.applyNow': 'Apply for Partner Program',
    'monetization.activePartner': 'Active Monetized Partner',
    'monetization.eligible': 'Eligible to Activate',
    'monetization.inProgress': 'Eligibility in Progress',
    'upload.title': 'Create & Upload',
    'upload.galleryTab': 'Upload from Gallery',
    'upload.recordTab': 'Record Video',
    'upload.urlTab': 'Stream URL',
    'upload.selectFromGallery': 'Choose Video from Gallery / Files',
    'upload.startRecording': 'Start Recording',
    'upload.stopRecording': 'Stop & Preview',
    'upload.useRecorded': 'Use Recorded Clip',
    'upload.filters': 'Video Filters',
    'upload.language': 'Video Language',
    'upload.monetization': 'Enable Monetization',
    'reels.follow': 'Follow',
    'reels.following': 'Following',
    'reels.save': 'Save',
    'reels.saved': 'Saved',
    'reels.share': 'Share',
    'reels.captions': 'Captions',
    'reels.description': 'Description',
  },
  hi: {
    'nav.home': 'होम',
    'nav.reels': 'शॉर्ट्स और रील्स',
    'nav.reelsShort': 'रील्स',
    'nav.following': 'फ़ॉलोइंग',
    'nav.you': 'आप',
    'nav.history': 'हिस्ट्री',
    'nav.watchLater': 'बाद में देखें',
    'nav.playlists': 'प्लेलिस्ट',
    'nav.likedVideos': 'पसंद किए गए वीडियो',
    'nav.studio': 'क्रिएटर स्टूडियो',
    'nav.studioShort': 'स्टूडियो',
    'nav.explore': 'एक्सप्लोर',
    'nav.trending': 'ट्रेंडिंग',
    'nav.customFeed': 'कस्टम फ़ीड',
    'nav.settings': 'सेटिंग्स',
    'nav.videoFilters': 'वीडियो फ़िल्टर',
    'nav.shortcuts': 'कीबोर्ड शॉर्टकट',
    'nav.create': 'बनाएँ',
    'nav.searchPlaceholder': 'खोजें',
    'nav.searchVio': 'Vio पर खोजें',
    'nav.signIn': 'साइन इन करें',
    'nav.signOut': 'साइन आउट',
    'nav.language': 'भाषा',
    'nav.appearance': 'थीम',
    'home.shortsAndReels': 'रील्स',
    'home.viewAll': 'सभी देखें',
    'home.noMatchingVideos': 'कोई वीडियो नहीं मिला',
    'home.tryAnother': 'कोई दूसरा कीवर्ड या कैटेगरी चुनें।',
    'home.trendingTitle': 'Vio पर ट्रेंडिंग',
    'home.trendingSubtitle': 'इस समय सबसे ज़्यादा देखे जाने वाले वीडियो, गेमिंग और रील्स',
    'cat.All': 'सभी',
    'cat.Custom Feed': 'कस्टम फ़ीड',
    'cat.Reels': 'रील्स',
    'cat.Trending': 'ट्रेंडिंग',
    'cat.Gaming': 'गेमिंग',
    'cat.Animation': 'एनिमेशन',
    'cat.Sci-Fi & VFX': 'साइ-फ़ाई और VFX',
    'cat.Nature & Wildlife': 'प्रकृति',
    'cat.Gaming & CGI': 'गेमिंग और CGI',
    'cat.Documentary': 'डॉक्यूमेंट्री',
    'cat.Music': 'संगीत',
    'cat.Education': 'शिक्षा',
    'cat.Recently Uploaded': 'हाल ही में अपलोड',
    'studio.dashboard': 'डैशबोर्ड',
    'studio.content': 'कंटेंट मैनेजर',
    'studio.analytics': 'चैनल एनालिटिक्स',
    'studio.hlsMetrics': 'HLS स्ट्रीमिंग',
    'studio.monetization': 'कमाई (Monetization)',
    'studio.colorLab': 'फ़िल्टर और फ़्रेमिंग',
    'studio.comments': 'कमेंट्स',
    'studio.branding': 'ब्रांडिंग',
    'studio.uploadVideo': 'वीडियो अपलोड करें',
    'monetization.title': 'क्रिएटर मोनेटाइज़ेशन और पार्टनर प्रोग्राम',
    'monetization.subtitle': 'YouTube जैसी पात्रता, विज्ञापन कमाई, मेंबरशिप और 30/70 पेआउट ट्रैक करें',
    'monetization.applyNow': 'मोनेटाइज़ेशन चालू करें',
    'monetization.activePartner': 'मोनेटाइज़ेशन सक्रिय',
    'monetization.eligible': 'आवेदन के लिए पात्र',
    'monetization.inProgress': 'लक्ष्य प्रगति पर है',
    'upload.title': 'वीडियो बनाएँ और अपलोड करें',
    'upload.galleryTab': 'गैलरी से चुनें',
    'upload.recordTab': 'कैमरा रिकॉर्डिंग',
    'upload.urlTab': 'स्ट्रीम URL',
    'upload.selectFromGallery': 'गैलरी / फ़ाइल से वीडियो चुनें',
    'upload.startRecording': 'रिकॉर्डिंग शुरू करें',
    'upload.stopRecording': 'रोकें और देखें',
    'upload.useRecorded': 'रिकॉर्डेड वीडियो इस्तेमाल करें',
    'upload.filters': 'वीडियो फ़िल्टर',
    'upload.language': 'वीडियो की भाषा',
    'upload.monetization': 'मोनेटाइज़ेशन चालू करें',
    'reels.follow': 'फ़ॉलो करें',
    'reels.following': 'फ़ॉलो किया',
    'reels.save': 'सेव',
    'reels.saved': 'सेव्ड',
    'reels.share': 'शेयर',
    'reels.captions': 'कैप्शन',
    'reels.description': 'विवरण',
  },
  hinglish: {
    'nav.home': 'Home',
    'nav.reels': 'Shorts & Reels',
    'nav.reelsShort': 'Reels',
    'nav.following': 'Following',
    'nav.you': 'Aap',
    'nav.history': 'History',
    'nav.watchLater': 'Baad mein dekhen',
    'nav.playlists': 'Playlists',
    'nav.likedVideos': 'Liked videos',
    'nav.studio': 'Creator Studio',
    'nav.studioShort': 'Studio',
    'nav.explore': 'Explore',
    'nav.trending': 'Trending',
    'nav.customFeed': 'Custom Feed',
    'nav.settings': 'Settings',
    'nav.videoFilters': 'Video Filters',
    'nav.shortcuts': 'Shortcuts',
    'nav.create': 'Create',
    'nav.searchPlaceholder': 'Search karein...',
    'nav.searchVio': 'Vio par search karein',
    'nav.signIn': 'Sign in',
    'nav.signOut': 'Sign Out',
    'nav.language': 'Bhasha (Language)',
    'nav.appearance': 'Theme',
    'home.shortsAndReels': 'Reels',
    'home.viewAll': 'Sab dekhen',
    'home.noMatchingVideos': 'Koi video nahi mila',
    'home.tryAnother': 'Koi aur keyword ya category try karein.',
    'home.trendingTitle': 'Vio par Trending',
    'home.trendingSubtitle': 'Sabse zyada dekhe jaane wale gaming clips, videos aur reels',
    'cat.All': 'All',
    'cat.Custom Feed': 'Custom Feed',
    'cat.Reels': 'Reels',
    'cat.Trending': 'Trending',
    'cat.Gaming': 'Gaming',
    'cat.Animation': 'Animation',
    'cat.Sci-Fi & VFX': 'Sci-Fi & VFX',
    'cat.Nature & Wildlife': 'Nature & Wildlife',
    'cat.Gaming & CGI': 'Gaming & CGI',
    'cat.Documentary': 'Documentary',
    'cat.Music': 'Music',
    'cat.Education': 'Education',
    'cat.Recently Uploaded': 'Naye Uploads',
    'studio.dashboard': 'Dashboard',
    'studio.content': 'Content Manager',
    'studio.analytics': 'Analytics',
    'studio.hlsMetrics': 'HLS Metrics',
    'studio.monetization': 'Monetization (Earn)',
    'studio.colorLab': 'Filter & Framing',
    'studio.comments': 'Comments',
    'studio.branding': 'Branding',
    'studio.uploadVideo': 'Video Upload Karein',
    'monetization.title': 'Creator Monetization & Partner Program',
    'monetization.subtitle': 'YouTube jaisi eligibility, Ad revenue, Super Thanks aur 30/70 payout dekhen',
    'monetization.applyNow': 'Monetization Activate Karein',
    'monetization.activePartner': 'Monetization Active Hai',
    'monetization.eligible': 'Apply Karne Ke Liye Ready',
    'monetization.inProgress': 'Target Progress Mein Hai',
    'upload.title': 'Video Upload & Record Studio',
    'upload.galleryTab': 'Gallery Se Chunen',
    'upload.recordTab': 'Video Record Karein',
    'upload.urlTab': 'Stream URL',
    'upload.selectFromGallery': 'Gallery / Device Se Video Chunen',
    'upload.startRecording': 'Record Shuru Karein',
    'upload.stopRecording': 'Stop & Preview',
    'upload.useRecorded': 'Ye Video Upload Karein',
    'upload.filters': 'Video Filters',
    'upload.language': 'Video Language',
    'upload.monetization': 'Monetization On Karein',
    'reels.follow': 'Follow',
    'reels.following': 'Following',
    'reels.save': 'Save',
    'reels.saved': 'Saved',
    'reels.share': 'Share',
    'reels.captions': 'Captions',
    'reels.description': 'Details',
  },
  es: {
    'nav.home': 'Inicio',
    'nav.reels': 'Shorts y Reels',
    'nav.reelsShort': 'Reels',
    'nav.following': 'Siguiendo',
    'nav.you': 'Tú',
    'nav.history': 'Historial',
    'nav.watchLater': 'Ver más tarde',
    'nav.playlists': 'Listas',
    'nav.likedVideos': 'Videos que me gustan',
    'nav.studio': 'Estudio de Creadores',
    'nav.studioShort': 'Estudio',
    'nav.explore': 'Explorar',
    'nav.trending': 'Tendencias',
    'nav.customFeed': 'Feed Personalizado',
    'nav.settings': 'Configuración',
    'nav.videoFilters': 'Filtros de Video',
    'nav.shortcuts': 'Atajos de Teclado',
    'nav.create': 'Crear',
    'nav.searchPlaceholder': 'Buscar',
    'nav.searchVio': 'Buscar en Vio streaming',
    'nav.signIn': 'Iniciar sesión',
    'nav.signOut': 'Cerrar sesión',
    'nav.language': 'Idioma',
    'nav.appearance': 'Apariencia',
    'home.shortsAndReels': 'Reels',
    'home.viewAll': 'Ver todo',
    'home.noMatchingVideos': 'No se encontraron videos',
    'home.tryAnother': 'Prueba otra búsqueda o categoría.',
    'home.trendingTitle': 'Tendencias en Vio streaming',
    'home.trendingSubtitle': 'Los videos de gaming, animaciones y reels más vistos ahora',
    'cat.All': 'Todo',
    'cat.Custom Feed': 'Personalizado',
    'cat.Reels': 'Reels',
    'cat.Trending': 'Tendencias',
    'cat.Gaming': 'Videojuegos',
    'cat.Animation': 'Animación',
    'cat.Sci-Fi & VFX': 'Ciencia Ficción',
    'cat.Nature & Wildlife': 'Naturaleza',
    'cat.Gaming & CGI': 'Gaming y CGI',
    'cat.Documentary': 'Documental',
    'cat.Music': 'Música',
    'cat.Education': 'Educación',
    'cat.Recently Uploaded': 'Recientes',
    'studio.dashboard': 'Panel',
    'studio.content': 'Contenido',
    'studio.analytics': 'Estadísticas',
    'studio.hlsMetrics': 'Métricas HLS',
    'studio.monetization': 'Monetización',
    'studio.colorLab': 'Color y Encuadre',
    'studio.comments': 'Comentarios',
    'studio.branding': 'Marca',
    'studio.uploadVideo': 'Subir Video',
    'monetization.title': 'Monetización y Programa de Socios',
    'monetization.subtitle': 'Sigue tu elegibilidad, ingresos por anuncios y pagos 30/70',
    'monetization.applyNow': 'Activar Monetización',
    'monetization.activePartner': 'Socio Activo',
    'monetization.eligible': 'Elegible para Activar',
    'monetization.inProgress': 'En Progreso',
    'upload.title': 'Crear y Subir',
    'upload.galleryTab': 'Subir de Galería',
    'upload.recordTab': 'Grabar Video',
    'upload.urlTab': 'URL de Stream',
    'upload.selectFromGallery': 'Elegir video de Galería / Archivos',
    'upload.startRecording': 'Iniciar Grabación',
    'upload.stopRecording': 'Detener y Ver',
    'upload.useRecorded': 'Usar Clip Grabado',
    'upload.filters': 'Filtros de Video',
    'upload.language': 'Idioma del Video',
    'upload.monetization': 'Activar Monetización',
    'reels.follow': 'Seguir',
    'reels.following': 'Siguiendo',
    'reels.save': 'Guardar',
    'reels.saved': 'Guardado',
    'reels.share': 'Compartir',
    'reels.captions': 'Subtítulos',
    'reels.description': 'Descripción',
  },
};

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string, fallback?: string) => string;
  activeOption: LanguageOption;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = 'vio_pref_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
      if (saved && APP_LANGUAGES.some((l) => l.code === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'en';
  });

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const htmlLang = language === 'hinglish' ? 'hi-Latn' : language;
    document.documentElement.lang = htmlLang;
  }, [language]);

  const t = useCallback(
    (key: string, fallback?: string) => {
      return TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || fallback || key;
    },
    [language]
  );

  const activeOption = APP_LANGUAGES.find((l) => l.code === language) || APP_LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, activeOption }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
};
