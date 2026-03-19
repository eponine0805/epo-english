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

// --- Exponential Backoff Retry ---
const fetchWithRetry = async (url, options, maxRetries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(`Client Error: ${response.status}`);
        }
        if (i === maxRetries - 1) throw new Error(`HTTP error! status: ${response.status}`);
        await new Promise(res => setTimeout(res, delays[i]));
        continue;
      }
      return response;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

// --- Evolution Data ---
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
        await signInAnonymously(auth);
      } catch (e) {
        setErrorMsg("認証エラー");
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
      } catch (e) {}
    };
    fetchData();
    return () => unsubProgress();
  }, [user]);

  const saveStatsToCloud = async (s, stats, disc, reincarn, charId = activeCharId, stage = activeStage) => {
    if (!user) return;
    try {
      const progressRef = doc(db, 'artifacts', appId, 'users', user.uid, 'metadata', 'progress');
      await setDoc(progressRef, { totalSeconds: s, genreStats: stats, discoveredIds: disc, reincarnationCount: reincarn, activeCharId: charId, activeStage: stage, updated: Date.now() }, { merge: true });
    } catch (e) {}
  };

  const updateDailyLogToCloud = async (secondsToAdd) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const logDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', today);
      await setDoc(logDoc, { seconds: increment(secondsToAdd) }, { merge: true });
      setDailyLogs(prev => ({ ...prev, [today]: (prev[today] || 0) + secondsToAdd }));
    } catch (e) {}
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
    if (totalSeconds > 0 && totalSeconds % 30 === 0) saveStatsToCloud(totalSeconds, genreStats, discoveredIds, reincarnationCount, activeCharId, activeStage);
    if (totalSeconds > 0 && totalSeconds % 10 === 0) updateDailyLogToCloud(10);
  }, [totalSeconds]);

  const currentStageCalculated = useMemo(() => {
    const s = totalSeconds;
    if (s < 600) return 1;
    if (s < 3600) return 2;
    if (s < 18000) return 3;
    if (s >= 36000) return 10;
    return 4 + Math.floor((s / 36000) * 5.9);
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
        if (currentStageCalculated === 10) nextChar = finals.find(e => e.id === 'f_goddess') || finals[0];
        else {
          let cat = topGenre === 'academic' ? 'academic' : topGenre === 'business' ? 'business' : topGenre === 'daily' ? 'daily' : topGenre === 'creative' ? 'creative' : 'balanced';
          const catGroup = finals.filter(f => f.category === cat);
          let idx = Math.min(currentStageCalculated - 4, catGroup.length - 1);
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
    return { ...char, level: Math.min(Math.floor(hours) + 1, 10), progress: (totalSeconds / 36000) * 100, hours: hours.toFixed(1) };
  }, [activeCharId, totalSeconds]);

  useEffect(() => {
    if (!isImgLoading) return;
    const msgs = ["魔法で召喚中...", "光を集めています...", "妖精を描画中...", "もうすぐ完成..."];
    let i = 0;
    setImgLoadingText(msgs[0]);
    const int = setInterval(() => { i = (i + 1) % msgs.length; setImgLoadingText(msgs[i]); }, 3000);
    return () => clearInterval(int);
  }, [isImgLoading]);

  useEffect(() => {
    let isMounted = true;
    const handleVisual = async () => {
      if (!user || !isDataLoaded || !apiKey) return;
      if (characterAlbum[currentCharacter.id] || generatingIdRef.current === currentCharacter.id) return;
      generatingIdRef.current = currentCharacter.id;
      setIsImgLoading(true);
      try {
        const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instances: [{ prompt: currentCharacter.prompt }], parameters: { sampleCount: 1 } })
        });
        const data = await res.json();
        if (data.predictions?.[0] && isMounted) {
          const b64 = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
          setCharacterAlbum(prev => ({ ...prev, [currentCharacter.id]: b64 }));
          await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'album', currentCharacter.id), { image: b64, savedAt: Date.now() });
        } else if (isMounted) setCharacterAlbum(prev => ({ ...prev, [currentCharacter.id]: 'error' }));
      } catch (e) { if (isMounted) setCharacterAlbum(prev => ({ ...prev, [currentCharacter.id]: 'error' })); } finally { 
        if (isMounted) setIsImgLoading(false);
        generatingIdRef.current = null;
      }
    };
    handleVisual();
    return () => { isMounted = false; };
  }, [currentCharacter.id, user, isDataLoaded, characterAlbum]);

  const robustParse = (text) => { try { const match = text.match(/\{[\s\S]*\}/); return JSON.parse(match ? match[0] : text); } catch (e) { return null; } };

  const generateContent = async () => {
    setIsLoading(true); setErrorMsg(null); setPronunciationScore(null); setRecordedUrl(null);
    const newStats = { ...genreStats, [genre]: (genreStats[genre] || 0) + 1 };
    setGenreStats(newStats);
    saveStatsToCloud(totalSeconds, newStats, discoveredIds, reincarnationCount, activeCharId, activeStage);
    let lengthInstruction = lengthType === 'single' ? "Exactly ONE single sentence." : lengthType === 'short' ? "A short paragraph (3-5 sentences)." : "A detailed essay (150-250 words).";
    const prompt = `Act as an expert English teacher for Epo-chan. Level: TOEIC ${toeicScore}. Genre: ${genre}. Length: ${lengthInstruction}. Output STRICTLY in JSON: {"english": "...", "japanese": "...", "context": "..."}`;

    try {
      const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.95 } })
      });
      const data = await res.json();
      const result = robustParse(data.candidates[0].content.parts[0].text);
      if (result) {
        setContent(result); setShowTranslation(false); setIsSettingsOpen(false);
        const ttsRes = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
      }
    } catch (e) { setErrorMsg(`エラー: ${e.message}`); } finally { setIsLoading(false); }
  };

  const scorePronunciation = async () => {
    if (!recordedUrl || !content.english) return;
    setIsScoring(true); setPronunciationScore(null);
    try {
      const response = await fetch(recordedUrl);
      const blob = await response.blob();
      const base64Audio = await new Promise((res) => { const r = new FileReader(); r.onloadend = () => res(r.result.split(',')[1]); r.readAsDataURL(blob); });
      const prompt = `Evaluate pronunciation for: "${content.english}". Return ONLY score (0-100).`;
      const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: blob.type.split(';')[0], data: base64Audio } }] }] })
      });
      const data = await res.json();
      const score = parseInt(data.candidates[0].content.parts[0].text.trim().replace(/[^0-9]/g, ''));
      setPronunciationScore(isNaN(score) ? "Err" : score);
    } catch (e) { setPronunciationScore("Err"); } finally { setIsScoring(false); }
  };

  const togglePlay = () => { if (audioRef.current) isPlaying ? audioRef.current.pause() : audioRef.current.play(); setIsPlaying(!isPlaying); };

  const graphData = useMemo(() => {
    const dates = [];
    for (let i = 14; i >= -15; i--) { 
      const d = new Date(); d.setDate(d.getDate() - i); const ds = d.toISOString().split('T')[0];
      dates.push({ ds, label: ds.slice(5), s: dailyLogs[ds] || 0, isToday: i === 0 });
    }
    const max = Math.max(...dates.map(x => x.s), 600);
    return dates.map(x => ({ ...x, h: (x.s / max) * 100, val: Math.floor(x.s/60) + 'm' }));
  }, [dailyLogs]);

  if (!isDataLoaded) return <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin text-indigo-500 w-12 h-12" /></div>;

  if (permissionStatus !== 'granted') return <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6"><Heart className="text-indigo-500 w-12 h-12 mb-6 animate-pulse" /><button onClick={async () => { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); setPermissionStatus('granted'); } catch(e) { setErrorMsg("許可が必要"); } }} className="bg-white text-slate-900 font-black px-12 py-4 rounded-2xl">STUDIO START</button></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-64">
        <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
          <header className="flex items-center justify-between py-2"><div className="flex items-center gap-2 italic font-black"><Sparkles className="text-indigo-600" />STUDIO</div><div className="flex gap-2"><button onClick={() => setIsStatsOpen(true)} className="p-2 bg-white rounded-full shadow-sm px-4 text-[10px] font-black uppercase flex items-center gap-1"><BarChart3 className="w-4 h-4"/> 記録</button><button onClick={() => setIsZukanOpen(true)} className="p-2 bg-white rounded-full shadow-sm px-4 text-[10px] font-black uppercase flex items-center gap-1"><Library className="w-4 h-4"/> 図鑑</button></div></header>
          {errorMsg && <div className="bg-rose-100 p-3 rounded-2xl text-xs text-rose-600 animate-in slide-in-from-top">{errorMsg}</div>}
          {isSettingsOpen ? (
            <section className="bg-white rounded-3xl shadow-sm p-6 space-y-6 animate-in zoom-in-95">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Score</label><input type="number" value={toeicScore} onChange={e => setToeicScore(parseInt(e.target.value))} className="w-full p-4 bg-slate-50 rounded-2xl font-mono text-lg" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Length</label><div className="flex bg-slate-100 p-1 rounded-2xl h-[60px]">{['single', 'short', 'essay'].map(t => (<button key={t} onClick={() => setLengthType(t)} className={`flex-1 text-[10px] font-black rounded-xl ${lengthType === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>{t === 'single' ? '1文' : t === 'short' ? '短文' : 'Essay'}</button>))}</div></div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">English Genre</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[{ id: 'business', l: 'Business', i: <Briefcase className="w-3 h-3"/> }, { id: 'daily', l: 'Daily', i: <MessageCircle className="w-3 h-3"/> }, { id: 'creative', l: 'Creative', i: <Film className="w-3 h-3"/> }, { id: 'academic', l: 'Academic', i: <GraduationCap className="w-3 h-3"/> }].map(g => (<button key={g.id} onClick={() => setGenre(g.id)} className={`flex items-center gap-2 p-3 rounded-xl border-2 ${genre === g.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>{g.i}<span className="text-[10px] font-bold">{g.l}</span></button>))}</div>
              </div>
              <button onClick={generateContent} disabled={isLoading} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3">{isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />} Generate Phrase</button>
            </section>
          ) : (
            (content.english || isLoading) && (
              <div className="animate-in fade-in duration-500"><div className="bg-white rounded-[2.5rem] shadow-xl p-10 md:p-16 text-center relative overflow-hidden min-h-[420px] flex flex-col items-center justify-center">
                {isLoading ? <Loader2 className="animate-spin w-12 h-12 text-slate-200" /> : (
                  <>
                    <div className="mb-10 text-[10px] font-black text-indigo-400 uppercase tracking-widest">{genre} · Lv.{toeicScore}</div>
                    <p className="text-2xl md:text-4xl font-bold leading-tight text-slate-800 tracking-tight">"{content.english}"</p>
                    <button onClick={() => setShowTranslation(!showTranslation)} className="mt-12 text-[9px] font-black text-slate-300 uppercase tracking-widest">{showTranslation ? 'Hide' : 'Translation'}</button>
                    {showTranslation && <p className="mt-4 text-lg text-slate-500 font-medium animate-in fade-in slide-in-from-top-2">{content.japanese}</p>}
                  </>
                )}
              </div></div>
            )
          )}
        </div>
      </div>

      <div className="fixed bottom-[230px] md:bottom-[180px] left-6 z-40 select-none group">
        <div className="bg-white rounded-2xl shadow-xl p-4 w-48 mb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase"><span>{currentCharacter.rarity}</span><span>Lv.{currentCharacter.level}</span></div>
          <div className="text-sm font-bold text-slate-700 mb-1">{currentCharacter.name}</div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${currentCharacter.progress}%` }}></div></div>
        </div>
        <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center cursor-pointer">
          {isImgLoading ? <Loader2 className="animate-spin text-indigo-400" /> : characterAlbum[currentCharacter.id] ? <img src={characterAlbum[currentCharacter.id]} className="w-full h-full object-contain drop-shadow-md" style={{ mixBlendMode: 'multiply' }} /> : <div className="text-4xl animate-bounce-slow">✨</div>}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-slate-200 p-4 md:p-8 z-50">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button onClick={() => { if(audioRef.current) audioRef.current.currentTime -= 10; }} className="p-2 text-slate-300 hover:text-indigo-600"><RotateCcw className="w-6 h-6" /></button>
              <button onClick={togglePlay} className="w-14 h-14 md:w-16 md:h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg">{isPlaying ? <Pause className="fill-current w-7 h-7" /> : <Play className="fill-current ml-1 w-7 h-7" />}</button>
              <input type="range" min="0" max={duration} step="0.01" value={currentTime} onChange={e => { const t = parseFloat(e.target.value); if(audioRef.current) audioRef.current.currentTime = t; }} className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none accent-indigo-600" />
            </div>
            <div className="flex items-center gap-3 px-2"><Gauge className="w-3 h-3 text-slate-400" /><input type="range" min="0.75" max="1.25" step="0.05" value={playbackRate} onChange={e => setPlaybackRate(parseFloat(e.target.value))} className="flex-1 h-1 bg-slate-100 rounded-full appearance-none accent-indigo-400" /><span className="text-[8px] font-black text-slate-400">{playbackRate.toFixed(2)}x</span></div>
          </div>
          <div className="hidden md:block w-px h-16 bg-slate-100 mx-4"></div>
          <div className="flex items-center justify-center md:justify-end gap-3">
            <button onClick={() => { setPronunciationScore(null); navigator.mediaDevices.getUserMedia({ audio: true }).then(s => { const mr = new MediaRecorder(s); mediaRecorderRef.current = mr; mr.start(); chunksRef.current = []; mr.ondataavailable = e => chunksRef.current.push(e.data); mr.onstop = () => { setRecordedUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: 'audio/webm' }))); setIsRecording(false); s.getTracks().forEach(t => t.stop()); }; setIsRecording(true); }); }} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-slate-900 animate-pulse' : 'bg-rose-500 hover:bg-rose-600 shadow-lg text-white'}`}>{isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}</button>
            <button onClick={() => { if(recordedUrl) { const a = new Audio(recordedUrl); a.play(); } }} disabled={!recordedUrl} className={`w-14 h-14 rounded-2xl flex items-center justify-center ${recordedUrl ? 'bg-white border-2 border-indigo-100 text-indigo-600 shadow-sm' : 'bg-slate-50 text-slate-200'}`}><UserCircle2 className="w-7 h-7" /></button>
            <div className="relative">
              <button onClick={scorePronunciation} disabled={!recordedUrl || isScoring} className="w-14 h-14 bg-amber-50 text-amber-500 border-2 border-amber-100 rounded-2xl flex items-center justify-center shadow-sm">{isScoring ? <Loader2 className="animate-spin w-6 h-6" /> : <Star className="w-6 h-6 fill-current" />}</button>
              {pronunciationScore !== null && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-xl shadow-xl">{pronunciationScore}点</div>}
            </div>
          </div>
        </div>
        <audio ref={audioRef} src={audioUrl} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} onDurationChange={() => setDuration(audioRef.current?.duration || 0)} onEnded={() => setIsPlaying(false)} className="hidden" />
      </div>

      <style>{`@keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } } .animate-bounce-slow { animation: bounce-slow 3s infinite ease-in-out; }`}</style>
    </div>
  );
};

export default App;
