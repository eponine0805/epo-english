import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, Mic, Square, Volume2, 
  Settings, Languages, BookOpen, Send, Loader2, PlayCircle,
  Eye, EyeOff, ChevronUp, ChevronDown, Sparkles, Film, MessageCircle, Briefcase, Star,
  ShieldCheck, CheckCircle2, Home, UserCircle2, Gauge, GraduationCap, Heart, Trophy,
  Library, X, Lock, Zap, Crown, RefreshCcw, AlertCircle, Wand2, BarChart3
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, increment } from 'firebase/firestore';

// --- Firebase ---
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

// --- Retry Fetch ---
const fetchWithRetry = async (url, options, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(`Client Error: ${response.status}`);
        }
        await new Promise(res => setTimeout(res, 1000 * (i + 1)));
        continue;
      }
      return response;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(res => setTimeout(res, 1000 * (i + 1)));
    }
  }
};

// --- Evolution Data ---
const EVOLUTION_LIST = [
  { id: 'egg', phase: 1, name: 'はじまりの卵', rarity: 'Common', prompt: 'A mystical glowing fantasy egg, translucent with internal nebula colors, anime style, white background.' },
  { id: 'chibi_logic', phase: 2, name: 'ちび論理', rarity: 'Common', prompt: 'Cute chibi anime fairy girl, blue dress, holding a tiny book, white background.' },
  { id: 'chibi_art', phase: 2, name: 'ちび芸術', rarity: 'Common', prompt: 'Cute chibi anime fairy girl, pink dress, holding a paintbrush, white background.' },
  { id: 'chibi_life', phase: 2, name: 'ちび生活', rarity: 'Common', prompt: 'Cute chibi anime fairy girl, green outfit, warm hoodie, white background.' },
  { id: 'mid_scholar', phase: 3, name: '見習い学者', rarity: 'Uncommon', prompt: 'Beautiful young anime woman, academic uniform, smart glasses, white background.' },
  { id: 'mid_business', phase: 3, name: '若手社員', rarity: 'Uncommon', prompt: 'Beautiful young anime woman, stylish business suit, carrying a tablet, white background.' },
  { id: 'mid_traveler', phase: 3, name: '旅人妖精', rarity: 'Uncommon', prompt: 'Beautiful young anime woman, explorer outfit, holding a map, white background.' },
  { id: 'mid_muse', phase: 3, name: '感性のミューズ', rarity: 'Uncommon', prompt: 'Beautiful young anime woman, glowing dress, long hair, white background.' },
  { id: 'mid_shadow', phase: 3, name: '夜の彷徨い子', rarity: 'Uncommon', prompt: 'Beautiful young anime woman, elegant dark gothic dress, mysterious, white background.' },
  { id: 'f_goddess', phase: 4, name: '全知全能の女神', rarity: 'ULTRA RARE', category: 'balanced', prompt: 'Stunning anime supreme goddess, multiple wings, divine aura, white background.' },
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
  const [showTranslation, setShowTranslation] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isZukanOpen, setIsZukanOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [genreStats, setGenreStats] = useState({ business: 0, daily: 0, creative: 0, academic: 0 });
  const [discoveredIds, setDiscoveredIds] = useState(['egg']);
  const [activeCharId, setActiveCharId] = useState('egg');
  const [activeStage, setActiveStage] = useState(1);
  const [characterAlbum, setCharacterAlbum] = useState({});
  const [dailyLogs, setDailyLogs] = useState({}); 
  const [isImgLoading, setIsImgLoading] = useState(false);
  const [imgLoadingText, setImgLoadingText] = useState("召喚中...");
  const generatingIdRef = useRef(null);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    signInAnonymously(auth).catch(() => setErrorMsg("認証エラー"));
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const progressRef = doc(db, 'artifacts', appId, 'users', user.uid, 'metadata', 'progress');
    const unsub = onSnapshot(progressRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setTotalSeconds(d.totalSeconds || 0);
        setGenreStats(d.genreStats || { business: 0, daily: 0, creative: 0, academic: 0 });
        setDiscoveredIds(d.discoveredIds || ['egg']);
        setActiveCharId(d.activeCharId || 'egg');
        setActiveStage(d.activeStage || 1);
      }
      setIsDataLoaded(true);
    });
    return () => unsub();
  }, [user]);

  const updateDailyLogToCloud = async (s) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', today), { seconds: increment(s) }, { merge: true });
  };

  useEffect(() => {
    if (!user || !isDataLoaded || permissionStatus !== 'granted') return;
    const interval = setInterval(() => { if (!document.hidden) setTotalSeconds(prev => prev + 1); }, 1000);
    return () => clearInterval(interval);
  }, [user, isDataLoaded, permissionStatus]);

  useEffect(() => {
    if (totalSeconds > 0 && totalSeconds % 10 === 0) updateDailyLogToCloud(10);
  }, [totalSeconds]);

  const currentCharacter = useMemo(() => {
    const char = EVOLUTION_LIST.find(e => e.id === activeCharId) || EVOLUTION_LIST[0];
    return { ...char, level: Math.min(Math.floor(totalSeconds / 3600) + 1, 10), progress: (totalSeconds / 36000) * 100, hours: (totalSeconds / 3600).toFixed(1) };
  }, [activeCharId, totalSeconds]);

  // --- 画像生成（モデル名を imagen-3.0-generate-001 に統一） ---
  useEffect(() => {
    let isMounted = true;
    const handleVisual = async () => {
      if (!user || !isDataLoaded || !apiKey || characterAlbum[currentCharacter.id] || generatingIdRef.current === currentCharacter.id) return;
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
        }
      } catch (e) { console.error("Visual Gen Error:", e); } 
      finally { if (isMounted) setIsImgLoading(false); generatingIdRef.current = null; }
    };
    handleVisual();
    return () => { isMounted = false; };
  }, [currentCharacter.id, user, isDataLoaded, characterAlbum]);

  // --- 文章生成（モデル名を gemini-1.5-flash に統一） ---
  const generateContent = async () => {
    setIsLoading(true); setErrorMsg(null);
    const prompt = `Act as an expert English teacher. Level: TOEIC ${toeicScore}. Genre: ${genre}. Output JSON: {"english": "...", "japanese": "...", "context": "..."}`;
    try {
      const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      const data = await res.json();
      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      setContent(result); setShowTranslation(false); setIsSettingsOpen(false);
      
      const ttsRes = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: result.english }] }], generationConfig: { responseModalities: ["AUDIO"] } })
      });
      const ttsData = await ttsRes.json();
      setAudioUrl(`data:audio/wav;base64,${ttsData.candidates[0].content.parts[0].inlineData.data}`);
    } catch (e) { setErrorMsg("生成エラー。APIキーや通信を確認してね。"); } finally { setIsLoading(false); }
  };

  const togglePlay = () => { if (audioRef.current) isPlaying ? audioRef.current.pause() : audioRef.current.play(); setIsPlaying(!isPlaying); };

  if (!isDataLoaded) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin" /></div>;

  if (permissionStatus !== 'granted') return <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6"><button onClick={async () => { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); setPermissionStatus('granted'); }} className="bg-white text-slate-900 font-black px-12 py-4 rounded-2xl">STUDIO START</button></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-64 p-4 md:p-8 space-y-6 max-w-2xl mx-auto">
        <header className="flex justify-between font-black italic text-xl text-indigo-600"><div>STUDIO</div></header>
        {errorMsg && <div className="bg-rose-100 p-3 rounded-xl text-xs text-rose-600">{errorMsg}</div>}
        {isSettingsOpen ? (
          <div className="bg-white rounded-3xl p-6 shadow-sm space-y-6">
            <input type="number" value={toeicScore} onChange={e => setToeicScore(e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl" />
            <button onClick={generateContent} disabled={isLoading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">{isLoading ? "生成中..." : "Generate Phrase"}</button>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] shadow-xl p-10 text-center min-h-[300px] flex flex-col justify-center">
            <p className="text-2xl font-bold">"{content.english}"</p>
            <button onClick={() => setShowTranslation(!showTranslation)} className="mt-8 text-xs text-slate-300 uppercase">{showTranslation ? 'Hide' : 'Translate'}</button>
            {showTranslation && <p className="mt-4 text-slate-500">{content.japanese}</p>}
          </div>
        )}
      </div>

      {/* Partner Display */}
      <div className="fixed bottom-40 left-6 z-40">
        <div className="w-24 h-24 flex items-center justify-center">
          {isImgLoading ? <Loader2 className="animate-spin text-indigo-400" /> : characterAlbum[currentCharacter.id] ? <img src={characterAlbum[currentCharacter.id]} className="w-full h-full object-contain drop-shadow-md" /> : <div className="text-4xl">✨</div>}
        </div>
        <div className="bg-white rounded-full px-3 py-1 shadow-sm text-[10px] font-black text-indigo-600 border border-indigo-50 mt-2">LV.{currentCharacter.level} {currentCharacter.name}</div>
      </div>

      {/* Audio Panel */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-6 pb-10">
        <div className="max-w-md mx-auto flex items-center justify-center gap-6">
          <button onClick={togglePlay} className="w-16 h-16 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center">{isPlaying ? <Pause /> : <Play className="ml-1" />}</button>
          <button onClick={() => { setRecordedUrl(null); navigator.mediaDevices.getUserMedia({ audio: true }).then(s => { const mr = new MediaRecorder(s); mediaRecorderRef.current = mr; mr.start(); chunksRef.current = []; mr.ondataavailable = e => chunksRef.current.push(e.data); mr.onstop = () => { setRecordedUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: 'audio/webm' }))); setIsRecording(false); s.getTracks().forEach(t => t.stop()); }; setIsRecording(true); }); }} className={`w-16 h-16 rounded-full flex items-center justify-center ${isRecording ? 'bg-slate-900 animate-pulse' : 'bg-rose-500 text-white shadow-lg'}`}>{isRecording ? <Square /> : <Mic />}</button>
          <button onClick={() => { if(recordedUrl) new Audio(recordedUrl).play(); }} disabled={!recordedUrl} className={`w-16 h-16 rounded-full border-2 ${recordedUrl ? 'border-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-200'}`}><UserCircle2 /></button>
        </div>
      </div>
      <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} hidden />
    </div>
  );
};
export default App;
