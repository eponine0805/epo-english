import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, Mic, Square, Volume2, 
  Settings, Languages, BookOpen, Send, Loader2, PlayCircle,
  Eye, EyeOff, ChevronUp, ChevronDown, Sparkles, Film, MessageCircle, Briefcase, Star,
  ShieldCheck, CheckCircle2, Home, UserCircle2, Gauge, GraduationCap, Heart, Trophy,
  Library, X, Lock, Zap, Crown, RefreshCcw, AlertCircle, Wand2, BarChart3
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, getDocs, updateDoc, increment } from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'epo-english-studio';
const apiKey = process.env.REACT_APP_GEMINI_API_KEY; 

// --- Exponential Backoff Retry (Fail-Fast for 4xx errors) ---
const fetchWithRetry = async (url, options, maxRetries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(`Client Error: ${response.status} - Safety Block or Bad Request`);
        }
        if (i === maxRetries - 1) throw new Error(`HTTP error! status: ${response.status}`);
        await new Promise(res => setTimeout(res, delays[i]));
        continue;
      }
      return response;
    } catch (e) {
      if (e.message && e.message.includes('Client Error')) throw e;
      if (i === maxRetries - 1) throw e;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

// --- Evolution Data (全39形態を網羅) ---
const EVOLUTION_LIST = [
  { id: 'egg', phase: 1, name: 'はじまりの卵', rarity: 'Common', prompt: 'A mystical glowing fantasy egg, translucent with internal nebula colors, anime style, pure white background.' },
  { id: 'chibi_logic', phase: 2, name: 'ちび論理', rarity: 'Common', prompt: 'Cute chibi anime fairy girl, blue dress, holding a tiny book, pure white background.' },
  { id: 'chibi_art', phase: 2, name: 'ちび芸術', rarity: 'Common', prompt: 'Cute chibi anime fairy girl, pink dress, holding a paintbrush, pure white background.' },
  { id: 'chibi_life', phase: 2, name: 'ちび生活', rarity: 'Common', prompt: 'Cute chibi anime fairy girl, green outfit, warm hoodie, pure white background.' },
  { id: 'mid_scholar', phase: 3, name: '見習い学者', rarity: 'Uncommon', prompt: 'Beautiful young anime woman, academic uniform, smart glasses, pure white background.' },
  { id: 'mid_business', phase: 3, name: '若手社員', rarity: 'Uncommon', prompt: 'Beautiful young anime woman, stylish business suit, carrying a tablet, pure white background.' },
  { id: 'mid_traveler', phase: 3, name: '旅人妖精', rarity: 'Uncommon', prompt: 'Beautiful young anime woman, explorer outfit, holding a map, pure white background.' },
  { id: 'mid_muse', phase: 3, name: '感性のミューズ', rarity: 'Uncommon', prompt: 'Beautiful young anime woman, glowing dress, long hair, pure white background.' },
  { id: 'mid_shadow', phase: 3, name: '夜の彷徨い子', rarity: 'Uncommon', prompt: 'Beautiful young anime woman, elegant dark gothic dress, mysterious, pure white background.' },
  { id: 'f_snow_queen', phase: 4, name: '氷の才女(雪女)', rarity: 'Epic', category: 'academic', prompt: 'Stunning anime woman, long silver hair, ice crystal dress, snow aura, pure white background.' },
  { id: 'f_ceo', phase: 4, name: '世界を変えるCEO', rarity: 'Epic', category: 'business', prompt: 'Stunning anime woman, commanding presence, office, pure white background.' },
  { id: 'f_idol', phase: 4, name: 'トップアイドル', rarity: 'Epic', category: 'daily', prompt: 'Stunning anime woman, sparkling idol outfit, stage lights, pure white background.' },
  { id: 'f_diva', phase: 4, name: '深海の歌姫', rarity: 'Epic', category: 'creative', prompt: 'Stunning anime mermaid woman, singing, blue hair, pure white background.' },
  { id: 'f_goddess', phase: 4, name: '全知全能の女神', rarity: 'ULTRA RARE', category: 'balanced', prompt: 'Stunning anime supreme goddess, multiple wings, divine aura, pure white background.' },
  { id: 'f_philosopher', phase: 4, name: '真理の哲学者', rarity: 'Rare', category: 'academic', prompt: 'Stunning anime woman, owl companion, intellectual atmosphere, pure white background.' },
  { id: 'f_scientist', phase: 4, name: '量子科学者', rarity: 'Rare', category: 'academic', prompt: 'Stunning anime woman, lab coat, floating energy particles, pure white background.' },
  { id: 'f_astrologer', phase: 4, name: '星読みの魔女', rarity: 'Epic', category: 'academic', prompt: 'Stunning anime woman, starry cape, telescope, pure white background.' },
  { id: 'f_space_explorer', phase: 4, name: '銀河の探査者', rarity: 'Legendary', category: 'academic', prompt: 'Stunning anime woman, celestial suit, nebula wings, pure white background.' },
  { id: 'f_library_spirit', phase: 4, name: '叡智の守護霊', rarity: 'Legendary', category: 'academic', prompt: 'Stunning anime ghost girl, surrounded by ancient books, pure white background.' },
  { id: 'f_manager', phase: 4, name: '敏腕マネージャー', rarity: 'Rare', category: 'business', prompt: 'Stunning anime woman, professional business wear, city view, pure white background.' },
  { id: 'f_diplomat', phase: 4, name: '誇り高き外交官', rarity: 'Rare', category: 'business', prompt: 'Stunning anime woman, elegant gown, flag of light, pure white background.' },
  { id: 'f_lawyer', phase: 4, name: '正義の弁護士', rarity: 'Epic', category: 'business', prompt: 'Stunning anime woman, courtroom attire, justice scale, pure white background.' },
  { id: 'f_trader', phase: 4, name: '黄金の相場師', rarity: 'Legendary', category: 'business', prompt: 'Stunning anime woman, gold ornaments, data charts, pure white background.' },
  { id: 'f_agent', phase: 4, name: '影の特務エージェント', rarity: 'Legendary', category: 'business', prompt: 'Stunning anime woman, stealth suit, tactical gear, pure white background.' },
  { id: 'f_chef', phase: 4, name: '至高の料理人', rarity: 'Rare', category: 'daily', prompt: 'Stunning anime woman, chef outfit, delicious aura, pure white background.' },
  { id: 'f_nurse', phase: 4, name: '癒やしの天使', rarity: 'Rare', category: 'daily', prompt: 'Stunning anime woman, futuristic nurse dress, heart aura, pure white background.' },
  { id: 'f_stewardess', phase: 4, name: '天空のアテンダント', rarity: 'Epic', category: 'daily', prompt: 'Stunning anime woman, flight uniform, sky background, pure white background.' },
  { id: 'f_queen_bee', phase: 4, name: '社交界の華', rarity: 'Legendary', category: 'daily', prompt: 'Stunning anime woman, glamorous dress, paparazzi lights, pure white background.' },
  { id: 'f_bride', phase: 4, name: '永遠の約束', rarity: 'Legendary', category: 'daily', prompt: 'Stunning anime woman, magnificent white wedding dress, pure white background.' },
  { id: 'f_painter', phase: 4, name: '極彩色の画家', rarity: 'Rare', category: 'creative', prompt: 'Stunning anime woman, paint splashes, large brush, pure white background.' },
  { id: 'f_dancer', phase: 4, name: '情熱の踊り子', rarity: 'Rare', category: 'creative', prompt: 'Stunning anime woman, fiery dress, dancing, pure white background.' },
  { id: 'f_phantom', phase: 4, name: '麗しき怪盗', rarity: 'Epic', category: 'creative', prompt: 'Stunning anime woman, top hat, mask, holding a jewel, pure white background.' },
  { id: 'f_moon_priest', phase: 4, name: '月光の巫女', rarity: 'Legendary', category: 'creative', prompt: 'Stunning anime woman, shrine maiden dress, crescent moon, pure white background.' },
  { id: 'f_dragon_rider', phase: 4, name: '竜を駆る聖女', rarity: 'Legendary', category: 'creative', prompt: 'Stunning anime woman, dragon scales, light armor, pure white background.' },
  { id: 'f_hikikomori', phase: 4, name: '真理の箱入り娘', rarity: 'Common', category: 'balanced', prompt: 'Stunning anime young woman, oversized sweater, gaming, pure white background.' },
  { id: 'f_cat_maid', phase: 4, name: '伝説の猫耳給仕', rarity: 'Rare', category: 'balanced', prompt: 'Stunning anime woman, cat ears, maid outfit, pure white background.' },
  { id: 'f_valkyrie', phase: 4, name: '戦乙女', rarity: 'Epic', category: 'balanced', prompt: 'Stunning anime woman, golden armor, white wings, pure white background.' },
  { id: 'f_vampire', phase: 4, name: '深紅の令嬢', rarity: 'Epic', category: 'balanced', prompt: 'Stunning anime woman, red eyes, black lace dress, pure white background.' },
  { id: 'f_saint', phase: 4, name: '光の聖母', rarity: 'Legendary', category: 'balanced', prompt: 'Stunning anime woman, halos of light, white dress, pure white background.' },
];

const App = () => {
  const [user, setUser] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('pending');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [toeicScore, setToeicScore] = useState(600);
  const [lengthType, setLengthType] = useState('short'); 
  const [genre, setGenre] = useState('daily');
  const [content, setContent] = useState({ english: '', japanese: '', context: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isZukanOpen, setIsZukanOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [statsView, setStatsView] = useState('daily'); 
  const [playbackRate, setPlaybackRate] = useState(1.0); 

  const [isScoring, setIsScoring] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState(null);

  const [totalSeconds, setTotalSeconds] = useState(0);
  const [genreStats, setGenreStats] = useState({ business: 0, daily: 0, creative: 0, academic: 0 });
  const [discoveredIds, setDiscoveredIds] = useState(['egg']);
  const [reincarnationCount, setReincarnationCount] = useState(0);
  const [activeCharId, setActiveCharId] = useState('egg');
  const [activeStage, setActiveStage] = useState(1);       
  
  const [characterAlbum, setCharacterAlbum] = useState({});
  const [dailyLogs, setDailyLogs] = useState({}); 
  const [isImgLoading, setIsImgLoading] = useState(false);
  const [imgLoadingText, setImgLoadingText] = useState("召喚中...");
  const generatingIdRef = useRef(null);

  const audioRef = useRef(null);
  const graphScrollRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [isUserPlaying, setIsUserPlaying] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenErr) {
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        setErrorMsg("認証に失敗しました。ページを再読み込みしてください。");
        setIsDataLoaded(true);
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const progressRef = doc(db, 'artifacts', appId, 'users', user.uid, 'metadata', 'progress');
    const unsubProgress = onSnapshot(progressRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setTotalSeconds(d.totalSeconds || 0);
        setGenreStats(d.genreStats || { business: 0, daily: 0, creative: 0, academic: 0 });
        setDiscoveredIds(d.discoveredIds || ['egg']);
        setReincarnationCount(d.reincarnationCount || 0);
        setActiveCharId(d.activeCharId || 'egg');
        setActiveStage(d.activeStage || 1);
      }
      setIsDataLoaded(true);
    }, (err) => {
      setIsDataLoaded(true);
      setErrorMsg("データの読み込みに失敗しました。");
    });

    const fetchData = async () => {
      try {
        const albumSnap = await getDocs(collection(db, 'artifacts', appId, 'users', user.uid, 'album'));
        const albumData = {};
        albumSnap.forEach(d => { albumData[d.id] = d.data().image; });
        setCharacterAlbum(albumData);

        const logsSnap = await getDocs(collection(db, 'artifacts', appId, 'users', user.uid, 'logs'));
        const logsData = {};
        logsSnap.forEach(d => { logsData[d.id] = d.data().seconds; });
        setDailyLogs(logsData);
      } catch (e) { console.error("Fetch Data Error:", e); }
    };
    fetchData();

    return () => unsubProgress();
  }, [user]);

  const saveStatsToCloud = async (s, stats, disc, reincarn, charId = activeCharId, stage = activeStage) => {
    if (!user) return;
    try {
      const progressRef = doc(db, 'artifacts', appId, 'users', user.uid, 'metadata', 'progress');
      await setDoc(progressRef, { 
        totalSeconds: s, 
        genreStats: stats, 
        discoveredIds: disc, 
        reincarnationCount: reincarn, 
        activeCharId: charId,
        activeStage: stage,
        updated: Date.now() 
      }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const updateDailyLogToCloud = async (secondsToAdd) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const logDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', today);
      await setDoc(logDoc, { seconds: increment(secondsToAdd) }, { merge: true });
      setDailyLogs(prev => ({ ...prev, [today]: (prev[today] || 0) + secondsToAdd }));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!user || !isDataLoaded || permissionStatus !== 'granted') return;
    const interval = setInterval(() => {
      if (document.hidden) return; 
      setTotalSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [user, isDataLoaded, permissionStatus]);

  useEffect(() => {
    if (totalSeconds > 0 && totalSeconds % 30 === 0) {
      saveStatsToCloud(totalSeconds, genreStats, discoveredIds, reincarnationCount, activeCharId, activeStage);
    }
    if (totalSeconds > 0 && totalSeconds % 10 === 0) {
      updateDailyLogToCloud(10);
    }
  }, [totalSeconds]);

  const currentStageCalculated = useMemo(() => {
    const s = totalSeconds;
    if (s < 600) return 1; 
    if (s < 3600) return 2; 
    if (s < 18000) return 3; 
    if (s >= 36000) return 10; 
    const ratio = s / 36000;
    return 4 + Math.floor(ratio * 5.9); 
  }, [totalSeconds]);

  useEffect(() => {
    if (!user || !isDataLoaded) return;
    if (currentStageCalculated > activeStage) {
      const topGenre = Object.keys(genreStats).reduce((a, b) => (genreStats[a] || 0) >= (genreStats[b] || 0) ? a : b, 'daily');
      let nextChar = EVOLUTION_LIST[0];

      if (currentStageCalculated === 2) {
        if (topGenre === 'academic' || topGenre === 'business') nextChar = EVOLUTION_LIST[1];
        else if (topGenre === 'creative') nextChar = EVOLUTION_LIST[2];
        else nextChar = EVOLUTION_LIST[3];
      } else if (currentStageCalculated === 3) {
        if ((genreStats[topGenre] || 0) < 5) nextChar = EVOLUTION_LIST[8];
        else if (topGenre === 'academic') nextChar = EVOLUTION_LIST[4];
        else if (topGenre === 'business') nextChar = EVOLUTION_LIST[5];
        else if (topGenre === 'daily') nextChar = EVOLUTION_LIST[6];
        else nextChar = EVOLUTION_LIST[7];
      } else if (currentStageCalculated >= 4) {
        const finals = EVOLUTION_LIST.filter(e => e.phase === 4);
        if (currentStageCalculated === 10) {
          nextChar = finals.find(e => e.id === 'f_goddess') || finals[0];
        } else {
          let cat = topGenre === 'academic' ? 'academic' : topGenre === 'business' ? 'business' : topGenre === 'daily' ? 'daily' : topGenre === 'creative' ? 'creative' : 'balanced';
          const catGroup = finals.filter(f => f.category === cat);
          let idx = currentStageCalculated - 4;
          idx = Math.min(idx, catGroup.length - 1);
          nextChar = catGroup[idx] || catGroup[0];
        }
      }

      setActiveCharId(nextChar.id);
      setActiveStage(currentStageCalculated);
      
      const nextDisc = discoveredIds.includes(nextChar.id) ? discoveredIds : [...discoveredIds, nextChar.id];
      if (nextDisc.length !== discoveredIds.length) setDiscoveredIds(nextDisc);
      
      saveStatsToCloud(totalSeconds, genreStats, nextDisc, reincarnationCount, nextChar.id, currentStageCalculated);
    }
  }, [currentStageCalculated, activeStage, totalSeconds, genreStats, discoveredIds, reincarnationCount, user, isDataLoaded]);

  const currentCharacter = useMemo(() => {
    const hours = totalSeconds / 3600;
    const char = EVOLUTION_LIST.find(e => e.id === activeCharId) || EVOLUTION_LIST[0];
    return { 
      ...char, 
      level: Math.min(Math.floor(hours) + 1, 10), 
      progress: (totalSeconds / 36000) * 100, 
      hours: hours.toFixed(1) 
    };
  }, [activeCharId, totalSeconds]);


  useEffect(() => {
    if (!isImgLoading) return;
    const msgs = ["魔法で召喚中...", "光を集めています...", "妖精を描画中...", "もうすぐ完成..."];
    let i = 0;
    setImgLoadingText(msgs[0]);
    const int = setInterval(() => {
      i = (i + 1) % msgs.length;
      setImgLoadingText(msgs[i]);
    }, 3000);
    return () => clearInterval(int);
  }, [isImgLoading]);

  // ★ 画像生成の最新安定モデル（imagen-4.0-generate-001）
  useEffect(() => {
    let isMounted = true;
    const handleVisual = async () => {
      if (!user || !isDataLoaded) return;
      if (characterAlbum[currentCharacter.id] || generatingIdRef.current === currentCharacter.id) return;
      
      generatingIdRef.current = currentCharacter.id;
      setIsImgLoading(true);
      try {
        const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instances: [{ prompt: currentCharacter.prompt }], parameters: { sampleCount: 1 } })
        });
        const data = await res.json();
        if (data.predictions?.[0] && isMounted) {
          const b64 = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
          setCharacterAlbum(prev => ({ ...prev, [currentCharacter.id]: b64 }));
          await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'album', currentCharacter.id), { image: b64, savedAt: Date.now() });
        } else if (isMounted) {
          setCharacterAlbum(prev => ({ ...prev, [currentCharacter.id]: 'error' }));
        }
      } catch (e) { 
        console.error("Visual Gen Err:", e);
        if (isMounted) setCharacterAlbum(prev => ({ ...prev, [currentCharacter.id]: 'error' }));
      } finally { 
        if (isMounted) setIsImgLoading(false);
        if (generatingIdRef.current === currentCharacter.id) {
          generatingIdRef.current = null;
        }
      }
    };
    handleVisual();
    return () => { 
      isMounted = false;
      if (generatingIdRef.current === currentCharacter.id) {
        generatingIdRef.current = null;
        setIsImgLoading(false);
      }
    };
  }, [currentCharacter.id, user, isDataLoaded, characterAlbum]);

  const robustParse = (text) => {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : text);
    } catch (e) { return null; }
  };

  // ★ 文章・音声生成の最新安定モデル（gemini-2.5-flash）
  const generateContent = async () => {
    if(!apiKey) { setErrorMsg("APIキーが設定されていません。Netlifyの設定を確認してください。"); return; }
    setIsLoading(true); setErrorMsg(null); setPronunciationScore(null); setRecordedUrl(null);
    const newStats = { ...genreStats, [genre]: (genreStats[genre] || 0) + 1 };
    setGenreStats(newStats);
    saveStatsToCloud(totalSeconds, newStats, discoveredIds, reincarnationCount, activeCharId, activeStage);

    let lengthInstruction = "";
    if (lengthType === 'single') lengthInstruction = "Exactly ONE single sentence.";
    else if (lengthType === 'short') lengthInstruction = "A short paragraph consisting of exactly 3 to 5 sentences.";
    else if (lengthType === 'essay') lengthInstruction = "A detailed multi-paragraph text consisting of at least 3 paragraphs and approximately 150-250 words.";

    let genreInstruction = "";
    if (genre === 'business') genreInstruction = "Topic: Professional business scenario, office communication, or corporate strategy. Vary the industry wildly.";
    else if (genre === 'daily') genreInstruction = "Topic: Everyday casual conversation, daily routines, or practical life situations. Vary the setting wildly.";
    else if (genre === 'academic') genreInstruction = "Topic: Academic subject, scientific discovery, historical event, or university-level discussion. Vary the field wildly.";
    else if (genre === 'creative') {
      if (lengthType === 'single' || lengthType === 'short') genreInstruction = "Target: A very famous but RANDOMLY SELECTED quote from a movie, a wise saying by a historical figure, or an iconic line from a popular manga/anime. The 'context' field MUST be the work title or person name.";
      else genreInstruction = "Target: A highly unique and detailed review, analysis, or storytelling about a famous movie, historical figure, or iconic anime. The 'context' field MUST be the title or subject.";
    }

    const randomSeed = Math.floor(Math.random() * 100000000);
    const prompt = `Act as an expert English teacher creating learning material for Epo-chan.
    Target Student Level: TOEIC score ${toeicScore}. Ensure vocabulary, idioms, and grammar complexity strictly match this TOEIC level.
    Length Requirement: ${lengthInstruction}
    ${genreInstruction}
    CRITICAL INSTRUCTION: This is generation request #${randomSeed}. You MUST provide a COMPLETELY UNIQUE text. Think outside the box and ensure high diversity in vocabulary, topics, and phrasing.
    Output STRICTLY in JSON format with NO markdown wrapping or additional text:
    {"english": "<English text here>", "japanese": "<Natural Japanese translation here>", "context": "<Brief context, source, or situation>"}`;

    try {
      const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.95 } })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "通信エラー");

      const result = robustParse(data.candidates[0].content.parts[0].text);
      if (result) {
        setContent(result); setShowTranslation(false); setIsSettingsOpen(false);
        const ttsRes = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-tts:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: result.english }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } } })
        });
        const ttsData = await ttsRes.json();
        const b64 = ttsData.candidates[0].content.parts[0].inlineData.data;
        const pcm = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        const buf = new ArrayBuffer(44 + pcm.byteLength);
        const v = new DataView(buf);
        const s = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
        s(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); s(8, 'WAVE'); s(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 24000, true);
        v.setUint32(28, 48000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data');
        v.setUint32(40, pcm.byteLength, true); new Uint8Array(buf, 44).set(new Uint8Array(pcm));
        setAudioUrl(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      } else throw new Error("Parsed result is null");
    } catch (e) { setErrorMsg(`エラー: ${e.message}`); console.error(e); } finally { setIsLoading(false); }
  };

  // ★ 採点モデルの最新安定版（gemini-2.5-flash）
  const scorePronunciation = async () => {
    if (!recordedUrl || !content.english) return;
    setIsScoring(true); setPronunciationScore(null);
    try {
      const response = await fetch(recordedUrl);
      const blob = await response.blob();
      const base64Audio = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
      });
      const mimeType = blob.type ? blob.type.split(';')[0] : "audio/webm";
      const prompt = `Evaluate the English pronunciation of the following audio based on this exact text: "${content.english}". Return ONLY an integer score from 0 to 100 representing the pronunciation quality. Do not write anything else.`;

      const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: base64Audio } }] }] })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      const scoreText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      const score = parseInt(scoreText.replace(/[^0-9]/g, ''));
      setPronunciationScore(isNaN(score) ? "Err" : score);
    } catch (e) { console.error("Scoring error:", e); setPronunciationScore("Err"); } finally { setIsScoring(false); }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); } 
    else { audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error("Play failed", e)); }
  };

  const graphData = useMemo(() => {
    try {
      if (statsView === 'daily') {
        const dates = [];
        for (let i = 14; i >= -15; i--) { 
          const d = new Date(); d.setDate(d.getDate() - i);
          const ds = d.toISOString().split('T')[0];
          dates.push({ ds, label: ds.slice(5), s: dailyLogs[ds] || 0, isToday: i === 0 });
        }
        const max = Math.max(...dates.map(x => x.s), 600);
        return dates.map(x => ({ ...x, h: (x.s / max) * 100, val: Math.floor(x.s/60) + 'm' }));
      } else if (statsView === 'weekly') {
        const weeks = [];
        const currentWeekStart = new Date();
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        for (let i = 5; i >= -6; i--) { 
          let total = 0;
          const d = new Date(currentWeekStart); d.setDate(d.getDate() - (i * 7));
          for (let j = 0; j < 7; j++) {
            const target = new Date(d); target.setDate(target.getDate() + j);
            total += (dailyLogs[target.toISOString().split('T')[0]] || 0);
          }
          weeks.push({ ds: `w${i}`, label: i === 0 ? 'This W' : (i > 0 ? `-W${i}` : `+W${Math.abs(i)}`), s: total, isToday: i === 0 });
        }
        const max = Math.max(...weeks.map(x => x.s), 3600);
        return weeks.map(x => ({ ...x, h: (x.s / max) * 100, val: Math.floor(x.s/60) + 'm' }));
      } else {
        const months = [];
        for (let i = 5; i >= -6; i--) { 
          const d = new Date(); d.setMonth(d.getMonth() - i);
          const year = d.getFullYear(); const month = d.getMonth() + 1;
          let total = 0;
          Object.keys(dailyLogs).forEach(date => {
            if (date.startsWith(`${year}-${month.toString().padStart(2, '0')}`)) total += dailyLogs[date];
          });
          months.push({ ds: `m${i}`, label: month + '月', s: total, isToday: i === 0 });
        }
        const max = Math.max(...months.map(x => x.s), 36000);
        return months.map(x => ({ ...x, h: (x.s / max) * 100, val: Math.floor(x.s/3600) + 'h' }));
      }
    } catch(e) { return []; }
  }, [dailyLogs, statsView]);

  useEffect(() => {
    if (isStatsOpen && graphScrollRef.current) {
      const container = graphScrollRef.current;
      container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
    }
  }, [isStatsOpen, statsView, graphData]);

  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = playbackRate; }, [playbackRate, audioUrl]);

  if (!isDataLoaded) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
        <p className="text-xs font-black tracking-widest uppercase text-slate-400">Loading Studio Data...</p>
        {errorMsg && (
          <div className="mt-6 flex flex-col items-center gap-4 animate-in fade-in">
            <p className="text-rose-400 text-xs">{errorMsg}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-rose-500 hover:bg-rose-600 rounded-full text-xs font-bold transition-all active:scale-95">再読み込み</button>
          </div>
        )}
      </div>
    );
  }

  if (permissionStatus !== 'granted') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <Heart className="w-12 h-12 mb-6 text-indigo-500 animate-pulse fill-current" />
        <h1 className="text-2xl font-black mb-4 uppercase tracking-widest italic">EPO'S STUDIO</h1>
        <p className="text-slate-400 text-xs mb-8 max-w-xs leading-relaxed">マイクを許可して、パートナーを成長させましょう。<br/>スタジオに滞在した時間だけ、あなたの努力が記録されます。</p>
        <button 
          onClick={async () => {
            try {
              const s = await navigator.mediaDevices.getUserMedia({ audio: true });
              s.getTracks().forEach(t => t.stop());
              setPermissionStatus('granted');
            } catch(e) { setErrorMsg("マイクの使用を許可してください。"); }
          }} 
          className="bg-white text-slate-900 font-black px-12 py-4 rounded-2xl active:scale-95 transition-all shadow-xl"
        >
          STUDIO START
        </button>
        {errorMsg && <p className="mt-4 text-rose-400 text-xs font-bold">{errorMsg}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-64">
        <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
          <header className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 italic">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-black tracking-tighter uppercase">Studio</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsStatsOpen(true)} className="p-2 text-slate-400 hover:text-indigo-600 bg-white rounded-full shadow-sm px-4 text-[10px] font-black uppercase flex items-center gap-1"><BarChart3 className="w-4 h-4" /> 記録</button>
              <button onClick={() => setIsZukanOpen(true)} className="p-2 text-slate-400 hover:text-indigo-600 bg-white rounded-full shadow-sm px-4 text-[10px] font-black uppercase flex items-center gap-1"><Library className="w-4 h-4" /> 図鑑</button>
              {!isSettingsOpen && <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-indigo-600 bg-white rounded-full shadow-sm px-4 text-[10px] font-black uppercase"><Home className="w-4 h-4" /></button>}
            </div>
          </header>

          {errorMsg && <div className="bg-rose-100 border border-rose-200 p-3 rounded-2xl text-xs text-rose-600 flex items-center gap-2 animate-in slide-in-from-top"><AlertCircle className="w-4 h-4" /> {errorMsg}</div>}

          {isSettingsOpen ? (
            <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6 animate-in fade-in zoom-in-95">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Score</label><input type="number" value={toeicScore} onChange={e => setToeicScore(parseInt(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-mono text-lg outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Length</label><div className="flex bg-slate-100 p-1 rounded-2xl h-[60px]">{['single', 'short', 'essay'].map(t => (<button key={t} onClick={() => setLengthType(t)} className={`flex-1 text-[10px] font-black rounded-xl transition-all ${lengthType === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>{t === 'single' ? '1文' : t === 'short' ? '短文' : 'Essay'}</button>))}</div></div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">English Genre</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[{ id: 'business', l: 'Business', i: <Briefcase className="w-3 h-3"/> }, { id: 'daily', l: 'Daily', i: <MessageCircle className="w-3 h-3"/> }, { id: 'creative', l: 'Creative', i: <Film className="w-3 h-3"/> }, { id: 'academic', l: 'Academic', i: <GraduationCap className="w-3 h-3"/> }].map(g => (
                    <button key={g.id} onClick={() => setGenre(g.id)} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${genre === g.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>{g.i} <span className="text-[10px] font-bold">{g.l}</span></button>
                  ))}
                </div>
              </div>
              <button onClick={generateContent} disabled={isLoading} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xs uppercase tracking-widest">{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Generate Phrase</button>
            </section>
          ) : (
             (content.english || isLoading) && (
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="bg-white rounded-[2.5rem] shadow-xl p-10 md:p-16 border border-slate-50 min-h-[420px] flex flex-col items-center justify-center text-center relative overflow-hidden">
                  {isLoading ? <div className="space-y-6 w-full max-w-sm"><div className="h-10 bg-slate-50 rounded-full animate-pulse"></div><div className="h-10 bg-slate-50 rounded-full animate-pulse w-3/4 mx-auto"></div></div> : (
                    <>
                      <div className="mb-10 space-y-2">
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">{genre} · Lv.{toeicScore}</div>
                        {content.context && <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.1em]">— {content.context}</div>}
                      </div>
                      <p className="text-2xl md:text-4xl font-bold leading-tight text-slate-800 tracking-tight">"{content.english}"</p>
                      <div className="mt-12 pt-8 border-t border-slate-50 w-full max-w-xs mx-auto">
                        <button onClick={() => setShowTranslation(!showTranslation)} className="text-[9px] font-black text-slate-300 hover:text-indigo-400 uppercase tracking-[0.2em] mb-4 outline-none">{showTranslation ? 'Hide Translation' : 'View Translation'}</button>
                        {showTranslation && <p className="text-lg text-slate-500 font-medium animate-in fade-in slide-in-from-top-2 leading-relaxed">{content.japanese}</p>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* CHARACTER UI - SYNCED & TRANSPARENT */}
      <div className="fixed bottom-[230px] md:bottom-[180px] left-6 z-40 group select-none">
        <div className="relative">
          <div className="absolute bottom-full left-0 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-4 w-48 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black text-slate-400 tracking-tighter uppercase"><span>{currentCharacter.rarity}</span><span className="flex items-center gap-1 text-indigo-500"><Trophy className="w-3 h-3" /> Lv.{currentCharacter.level}</span></div>
              <div className="text-sm font-bold text-slate-700">{currentCharacter.name}</div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${currentCharacter.progress}%` }}></div></div>
              <div className="flex justify-between items-center text-[8px] text-slate-400 font-bold uppercase"><span>{currentCharacter.hours}h Study</span><span>Gen: {reincarnationCount}</span></div>
              {currentCharacter.phase >= 4 && (
                <button onClick={async (e) => { 
                  e.stopPropagation(); 
                  if(window.confirm("転生（記録リセット）しますか？図鑑やアルバムは残ります。")) { 
                    const nc = reincarnationCount+1; 
                    setTotalSeconds(0); 
                    setGenreStats({ business: 0, daily: 0, creative: 0, academic: 0 }); 
                    setReincarnationCount(nc); 
                    setActiveCharId('egg');
                    setActiveStage(1);
                    await saveStatsToCloud(0, { business: 0, daily: 0, creative: 0, academic: 0 }, discoveredIds, nc, 'egg', 1); 
                  } 
                }} className="w-full mt-2 bg-indigo-600 text-white text-[9px] font-black py-2 rounded-lg pointer-events-auto shadow-md">
                  最初からやり直す
                </button>
              )}
            </div>
            <div className="absolute bottom-[-6px] left-4 w-3 h-3 bg-white border-b border-r border-slate-100 rotate-45"></div>
          </div>
          
          <div 
            className="relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center pointer-events-auto cursor-pointer"
            onClick={() => {
              if (characterAlbum[currentCharacter.id] === 'error') {
                setCharacterAlbum(prev => { const next = {...prev}; delete next[currentCharacter.id]; return next; });
              }
            }}
          >
            {isImgLoading || generatingIdRef.current === currentCharacter.id ? (
              <div className="flex flex-col items-center justify-center animate-pulse">
                <Wand2 className="w-6 h-6 text-indigo-400 mb-1" />
                <span className="text-[6px] font-black text-indigo-400 whitespace-nowrap">{imgLoadingText}</span>
              </div>
            ) : characterAlbum[currentCharacter.id] === 'error' ? (
              <div className="flex flex-col items-center">
                <RefreshCcw className="w-6 h-6 text-rose-400 mb-1" />
                <span className="text-[8px] text-rose-400 font-bold">Retry</span>
              </div>
            ) : characterAlbum[currentCharacter.id] ? (
              <img src={characterAlbum[currentCharacter.id]} alt="Partner" className="w-full h-full object-contain animate-in fade-in duration-1000 filter drop-shadow-md" style={{ mixBlendMode: 'multiply' }} />
            ) : (
              <div className="text-4xl animate-bounce-slow">✨</div>
            )}
            <div className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full px-1.5 py-0.5 text-[8px] font-black border border-white z-10 shadow-sm">LV.{currentCharacter.level}</div>
          </div>
        </div>
      </div>

      {/* STATS MODAL (Center-focused) */}
      {isStatsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsStatsOpen(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-6 md:p-8 space-y-6 flex flex-col z-50 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <div><h2 className="text-xl font-black text-slate-800 italic uppercase">Practice Stats</h2><p className="text-xs text-slate-400">学習記録を振り返る</p></div>
              <button onClick={() => setIsStatsOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['daily', 'weekly', 'monthly'].map(mode => (
                <button key={mode} onClick={() => setStatsView(mode)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${statsView === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                  {mode === 'daily' ? 'Day' : mode === 'weekly' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>

            <div className="relative h-48 w-full border-b border-slate-100 pb-2">
              <div ref={graphScrollRef} className="flex items-end gap-2 px-2 overflow-x-auto h-full pb-4 scrollbar-hide scroll-smooth">
                {graphData.map((d, i) => (
                  <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2 group w-12 h-full">
                    <div className={`w-full rounded-lg relative overflow-hidden h-full flex items-end ${d.isToday ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                      <div className={`w-full rounded-t-lg transition-all duration-1000 ease-out ${d.isToday ? 'bg-indigo-600' : 'bg-indigo-400'}`} style={{ height: `${d.h}%` }}></div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600/10 text-[8px] font-bold text-indigo-900">{d.val}</div>
                    </div>
                    <span className={`text-[8px] font-black uppercase truncate w-full text-center ${d.isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Total Practice</p><p className="text-2xl font-black text-slate-800">{currentCharacter.hours} <span className="text-sm font-normal">h</span></p></div>
              <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[10px] text-slate-400 font-bold uppercase">Average</p><p className="text-2xl font-black text-indigo-600">{Math.floor((totalSeconds / (Object.keys(dailyLogs).length || 1)) / 60)} <span className="text-sm font-normal">m</span></p></div>
            </div>
          </div>
        </div>
      )}

      {/* ZUKAN MODAL */}
      {isZukanOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsZukanOpen(false)}></div>
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 z-50">
            <div className="p-8 border-b flex justify-between items-center bg-white sticky top-0 z-10"><div><h2 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">Partner Collection</h2><p className="text-[10px] text-indigo-600 font-black uppercase mt-1">転生: {reincarnationCount}回 | 発見: {discoveredIds.length} / 39</p></div><button onClick={() => setIsZukanOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors"><X className="w-5 h-5" /></button></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-10">
              {[1, 2, 3, 4].map(p => (
                <div key={p}><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="h-px flex-1 bg-slate-100"></div> PHASE {p} <div className="h-px flex-1 bg-slate-100"></div></h3><div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {EVOLUTION_LIST.filter(e => e.phase === p).map(item => {
                    const isFound = discoveredIds.includes(item.id); const savedImg = characterAlbum[item.id];
                    return (<div key={item.id} className={`p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-3 transition-all ${isFound ? 'border-indigo-50 bg-white shadow-sm' : 'border-slate-50 bg-slate-50 opacity-40 grayscale'}`}><div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center overflow-hidden">{isFound && savedImg && savedImg !== 'error' ? <img src={savedImg} className="w-full h-full object-contain filter drop-shadow-sm" style={{ mixBlendMode: 'multiply' }} /> : isFound ? <Sparkles className="w-6 h-6 text-indigo-200" /> : <Lock className="w-5 h-5 text-slate-200" />}</div><div className="text-[10px] font-black text-slate-800 leading-tight text-center">{isFound ? item.name : '???'}</div></div>);
                  })}
                  {p === 4 && Array.from({ length: Math.max(0, 30 - EVOLUTION_LIST.filter(e => e.phase === 4).length) }).map((_, i) => (
                    <div key={`extra-${i}`} className="p-4 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50 opacity-40 grayscale flex flex-col items-center gap-3"><div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center"><Lock className="w-5 h-5 text-slate-200" /></div><div className="text-[10px] font-black text-slate-800 leading-tight text-center">???</div></div>
                  ))}
                </div></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PLAYER PANEL */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-slate-200 p-4 md:p-8 z-50">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button onClick={() => { if(audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><RotateCcw className="w-6 h-6" /></button>
              <button onClick={togglePlay} disabled={!audioUrl || isTtsLoading} className="w-14 h-14 md:w-16 md:h-16 bg-indigo-600 disabled:bg-slate-200 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all">{isTtsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}</button>
              <div className="flex-1 min-w-0"><input type="range" min="0" max={duration || 0} step="0.01" value={currentTime} onChange={e => { const t = parseFloat(e.target.value); setCurrentTime(t); if(audioRef.current) audioRef.current.currentTime = t; }} className="w-full h-1 bg-slate-100 rounded-lg appearance-none accent-indigo-600 mb-1" /><div className="flex justify-between text-[8px] font-black font-mono text-slate-300 tracking-tighter"><span>{currentTime.toFixed(1)}s</span><span>{duration.toFixed(1)}s</span></div></div>
            </div>
            
            <div className="flex items-center gap-3 px-2">
              <Gauge className="w-3 h-3 text-slate-400" />
              <input 
                type="range" 
                min="0.75" 
                max="1.25" 
                step="0.05" 
                value={playbackRate} 
                onChange={e => setPlaybackRate(parseFloat(e.target.value))} 
                className="flex-1 h-1 bg-slate-100 rounded-full appearance-none accent-indigo-400" 
              />
              <span className="text-[8px] font-black text-slate-400 w-6">{playbackRate.toFixed(2)}x</span>
            </div>
          </div>
          <div className="hidden md:block w-px h-16 bg-slate-100 mx-4"></div>
          
          <div className="flex items-center justify-center md:justify-end gap-3">
            <div className="flex flex-col items-center">
              {!isRecording ? <button onClick={() => { setPronunciationScore(null); navigator.mediaDevices.getUserMedia({ audio: true }).then(s => { const mr = new MediaRecorder(s); mediaRecorderRef.current = mr; chunksRef.current = []; mr.ondataavailable = e => chunksRef.current.push(e.data); mr.onstop = () => { setRecordedUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: 'audio/webm' }))); setIsRecording(false); s.getTracks().forEach(t => t.stop()); }; mr.start(); setIsRecording(true); }).catch(e => setErrorMsg("マイク許可が必要です")); }} className="w-14 h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl shadow-lg flex items-center justify-center active:scale-95 transition-all"><Mic className="w-6 h-6" /></button> : <button onClick={() => { if(mediaRecorderRef.current) { mediaRecorderRef.current.stop(); } }} className="w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-lg flex items-center justify-center animate-pulse"><Square className="w-6 h-6" /></button>}
              <span className="text-[8px] font-black text-slate-400 mt-1 uppercase">Record</span>
            </div>

            <div className="flex flex-col items-center">
              <button onClick={() => { if(recordedUrl) { const a = new Audio(recordedUrl); setIsUserPlaying(true); a.onended = () => setIsUserPlaying(false); a.play().catch(() => setIsUserPlaying(false)); } }} disabled={!recordedUrl || isRecording} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${!recordedUrl || isRecording ? 'bg-slate-50 text-slate-200 border-2 border-slate-50' : isUserPlaying ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-200 animate-pulse' : 'bg-white text-indigo-600 border-2 border-indigo-100 shadow-sm hover:bg-indigo-50 active:scale-95'}`}><UserCircle2 className="w-7 h-7" /></button>
              <span className={`text-[8px] font-black mt-1 uppercase ${recordedUrl ? 'text-indigo-500' : 'text-slate-300'}`}>Review</span>
            </div>

            {recordedUrl && (
              <div className="flex flex-col items-center relative">
                <button 
                  onClick={scorePronunciation} 
                  disabled={isScoring || isRecording}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all bg-amber-50 text-amber-500 border-2 border-amber-100 shadow-sm hover:bg-amber-100 active:scale-95"
                >
                  {isScoring ? <Loader2 className="w-6 h-6 animate-spin" /> : <Star className="w-6 h-6 fill-current" />}
                </button>
                <span className="text-[8px] font-black mt-1 uppercase text-amber-500">Score</span>
                
                {pronunciationScore !== null && !isScoring && (
                  <div className="absolute left-full ml-3 top-[30%] -translate-y-1/2 bg-slate-900 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap animate-in slide-in-from-left-2 z-50">
                    {pronunciationScore === "Err" ? "エラー" : `${pronunciationScore} 点`}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <audio ref={audioRef} src={audioUrl} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} onDurationChange={() => setDuration(audioRef.current?.duration || 0)} onEnded={() => setIsPlaying(false)} className="hidden" />
      </div>

      <style>{`
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-bounce-slow { animation: bounce-slow 3s infinite ease-in-out; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 12px; height: 12px; background: #6366f1; border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
};

export default App;
