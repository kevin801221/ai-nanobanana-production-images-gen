
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, ImageIcon, Sparkles, History, Download, RefreshCw, 
  X, Camera, Circle, Crop, Layers, Heart, Trash2, Bookmark, 
  Sun, Moon, Box, Tent, Crown, Cpu, Coffee, Settings2, ChevronDown, ChevronUp, Info,
  Undo, Redo, Wand2, Maximize2, SlidersHorizontal, Instagram, Facebook, Tv
} from 'lucide-react';
import Cropper, { Area } from 'react-easy-crop';
import { generateProductSceneVariations, suggestPrompts } from './services/geminiService';
import { GenerationHistory, GenerationStatus, SavedCreation, AIConfig, ImageFilters } from './types';
import { getHistoryItems, saveHistoryItems, getFavoriteItems, saveFavoriteItems } from './services/storageService';

const PROMPT_CATEGORIES = [
  { id: 'minimalist', name: 'Minimalist', icon: <Box className="w-4 h-4" />, prompts: ["Clean white studio background, soft shadows, geometric pedestals", "Soft beige textured wall, minimalist concrete platform"] },
  { id: 'luxury', name: 'Luxury', icon: <Crown className="w-4 h-4" />, prompts: ["Dark polished black marble, elegant gold accents", "Royal velvet drapery, warm spotlighting"] },
  { id: 'nature', name: 'Nature', icon: <Tent className="w-4 h-4" />, prompts: ["Morning sunlight through forest leaves, mossy stone", "Tropical beach setting at golden hour"] },
  { id: 'futuristic', name: 'Futuristic', icon: <Cpu className="w-4 h-4" />, prompts: ["Cyberpunk neon-lit alleyway, purple and cyan palette", "Clean spaceship interior, sleek metallic surfaces"] },
  { id: 'lifestyle', name: 'Lifestyle', icon: <Coffee className="w-4 h-4" />, prompts: ["Cozy wooden cabin table, warm hygge atmosphere", "Modern bright kitchen countertop"] }
];

interface CropStateSnapshot { crop: { x: number; y: number }; zoom: number; aspect: number | undefined; }

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ps_theme');
    return (saved as 'light' | 'dark') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [savedCreations, setSavedCreations] = useState<SavedCreation[]>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [backgroundPrompt, setBackgroundPrompt] = useState<string>('');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [variationCount, setVariationCount] = useState<number>(3);
  const [activeCategory, setActiveCategory] = useState(PROMPT_CATEGORIES[0].id);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  // Filters & Comparison State
  const [filters, setFilters] = useState<ImageFilters>({ brightness: 100, contrast: 100, saturation: 100 });
  const [showComparison, setShowComparison] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);

  // Advanced AI Config
  const [aiConfig, setAiConfig] = useState<AIConfig>({ temperature: 1.0, topK: 64, topP: 0.95 });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'recent' | 'favorites'>('recent');
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Cropping states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  // Cropping Undo/Redo States
  const [pastCrops, setPastCrops] = useState<CropStateSnapshot[]>([]);
  const [futureCrops, setFutureCrops] = useState<CropStateSnapshot[]>([]);
  const [stableCropState, setStableCropState] = useState<CropStateSnapshot | null>(null);
  const skipHistoryRef = useRef(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    localStorage.setItem('ps_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [storedHistory, storedFavorites] = await Promise.all([getHistoryItems(), getFavoriteItems()]);
        setHistory(storedHistory);
        setSavedCreations(storedFavorites);
      } catch (err) { console.error(err); } finally { setIsLoadingStorage(false); }
    };
    loadInitialData();
  }, []);

  useEffect(() => { if (!isLoadingStorage) saveHistoryItems(history); }, [history, isLoadingStorage]);
  useEffect(() => { if (!isLoadingStorage) saveFavoriteItems(savedCreations); }, [savedCreations, isLoadingStorage]);

  useEffect(() => {
    if (!isCropping) { setPastCrops([]); setFutureCrops([]); setStableCropState(null); return; }
    if (!stableCropState) { setStableCropState({ crop, zoom, aspect }); return; }
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }

    const timeout = setTimeout(() => {
      const currentState = { crop, zoom, aspect };
      if (JSON.stringify(currentState) !== JSON.stringify(stableCropState)) {
        setPastCrops(prev => [...prev, stableCropState]);
        setFutureCrops([]);
        setStableCropState(currentState);
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [crop, zoom, aspect, isCropping]);

  const handleUndoCrop = () => {
    if (pastCrops.length === 0) return;
    const previous = pastCrops[pastCrops.length - 1];
    const current = { crop, zoom, aspect };
    setFutureCrops(prev => [current, ...prev]);
    setPastCrops(prev => prev.slice(0, -1));
    skipHistoryRef.current = true;
    setCrop(previous.crop); setZoom(previous.zoom); setAspect(previous.aspect);
    setStableCropState(previous);
  };

  const handleRedoCrop = () => {
    if (futureCrops.length === 0) return;
    const next = futureCrops[0];
    const current = { crop, zoom, aspect };
    setPastCrops(prev => [...prev, current]);
    setFutureCrops(prev => prev.slice(1));
    skipHistoryRef.current = true;
    setCrop(next.crop); setZoom(next.zoom); setAspect(next.aspect);
    setStableCropState(next);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMimeType(file.type);
      const reader = new FileReader();
      reader.onloadend = () => { setTempImage(reader.result as string); setIsCropping(true); setCrop({ x: 0, y: 0 }); setZoom(1); setAspect(1); };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraActive(true);
    } catch (err) { setError("Camera access denied."); }
  };

  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); setIsCameraActive(false); };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        setTempImage(canvas.toDataURL('image/jpeg'));
        setMimeType('image/jpeg');
        setIsCropping(true); setCrop({ x: 0, y: 0 }); setZoom(1); setAspect(1);
        stopCamera();
      }
    }
  };

  const onCropComplete = useCallback((_a: Area, cp: Area) => setCroppedAreaPixels(cp), []);

  const handleCropSave = async () => {
    if (!tempImage || !croppedAreaPixels) return;
    try {
      const img = new Image(); img.src = tempImage; await new Promise(r => img.onload = r);
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return;
      canvas.width = croppedAreaPixels.width; canvas.height = croppedAreaPixels.height;
      ctx.drawImage(img, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, croppedAreaPixels.width, croppedAreaPixels.height);
      setSelectedImage(canvas.toDataURL(mimeType));
      setResultImages([]); setIsCropping(false); setTempImage(null); setStatus(GenerationStatus.IDLE);
    } catch (e) { setError("Crop failed."); }
  };

  const handleGenerate = async () => {
    if (!selectedImage || !backgroundPrompt) return;
    try {
      setStatus(GenerationStatus.GENERATING); setError(null);
      const results = await generateProductSceneVariations(selectedImage, mimeType, backgroundPrompt, variationCount, aiConfig);
      setResultImages(results); setSelectedResultIndex(0); setStatus(GenerationStatus.SUCCESS);
      setHistory(prev => [{ id: Date.now().toString(), originalImage: selectedImage, resultImages: results, selectedImageIndex: 0, prompt: backgroundPrompt, timestamp: Date.now() }, ...prev]);
    } catch (err: any) { setError(err.message); setStatus(GenerationStatus.ERROR); }
  };

  const handleSuggestPrompts = async () => {
    if (!selectedImage) return;
    try {
      setStatus(GenerationStatus.SUGGESTING);
      const suggestions = await suggestPrompts(selectedImage, mimeType);
      setAiSuggestions(suggestions);
      setStatus(GenerationStatus.IDLE);
    } catch (e) { setStatus(GenerationStatus.IDLE); }
  };

  const toggleSaveCreation = (img: string) => {
    const exists = savedCreations.find(s => s.image === img);
    if (exists) setSavedCreations(prev => prev.filter(s => s.image !== img));
    else setSavedCreations(prev => [{ id: Date.now().toString(), image: img, originalImage: selectedImage || '', prompt: backgroundPrompt, timestamp: Date.now() }, ...prev]);
  };

  const reset = () => { setSelectedImage(null); setResultImages([]); setBackgroundPrompt(''); setStatus(GenerationStatus.IDLE); setError(null); stopCamera(); setIsCropping(false); setAiSuggestions([]); setShowComparison(false); };

  const downloadImage = (url: string, name: string) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg"><Sparkles className="text-white w-5 h-5" /></div>
            <h1 className="font-bold text-xl text-slate-900 dark:text-white">ProductScene AI <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 px-2 py-0.5 rounded ml-2">PRO</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
            <button onClick={() => { setHistoryTab('favorites'); setShowHistory(true); }} className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <Heart className={`w-5 h-5 ${savedCreations.length > 0 ? 'fill-pink-500 text-pink-500' : ''}`} />
              <span className="hidden sm:inline font-medium">Saved</span>
            </button>
            <button onClick={() => { setHistoryTab('recent'); setShowHistory(true); }} className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <History className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">History</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[400px] flex flex-col relative">
              {isLoadingStorage && <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-10 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" /></div>}
              
              {!selectedImage && !isCameraActive && !isCropping ? (
                <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div onClick={() => fileInputRef.current?.click()} className="group flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-8">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-full"><Upload className="w-8 h-8 text-indigo-600" /></div>
                    <p className="mt-4 font-semibold dark:text-slate-100">Upload product photo</p>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>
                  <div onClick={startCamera} className="group flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-8">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-full"><Camera className="w-8 h-8 text-emerald-600" /></div>
                    <p className="mt-4 font-semibold dark:text-slate-100">Take a photo</p>
                  </div>
                </div>
              ) : isCropping && tempImage ? (
                <div className="relative flex-1 bg-slate-900 flex flex-col min-h-[500px]">
                  <div className="relative flex-1">
                    <Cropper image={tempImage} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
                    <div className="absolute top-4 left-4 flex gap-2 z-30">
                      <button onClick={handleUndoCrop} disabled={pastCrops.length === 0} className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-full shadow-lg disabled:opacity-30"><Undo className="w-5 h-5" /></button>
                      <button onClick={handleRedoCrop} disabled={futureCrops.length === 0} className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-full shadow-lg disabled:opacity-30"><Redo className="w-5 h-5" /></button>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 flex flex-col gap-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {[
                        {v: 1, l: 'Square', i: <Instagram className="w-3 h-3" />},
                        {v: 9/16, l: 'Story', i: <Tv className="w-3 h-3" />},
                        {v: 16/9, l: 'Banner', i: <Facebook className="w-3 h-3" />},
                        {v: undefined, l: 'Free', i: <Maximize2 className="w-3 h-3" />}
                      ].map(item => (
                        <button key={item.l} onClick={() => setAspect(item.v)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${aspect === item.v ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                          {item.i} {item.l}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <button onClick={() => { setIsCropping(false); setTempImage(null); }} className="px-6 py-2.5 rounded-xl text-slate-600 font-bold">Cancel</button>
                      <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-indigo-600" />
                      <button onClick={handleCropSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20">Confirm Crop</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative flex-1 bg-slate-100 dark:bg-slate-950 flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
                  <div className="flex-1 relative bg-white dark:bg-slate-900 rounded-lg shadow-inner flex items-center justify-center p-2 border dark:border-slate-800">
                    <img src={selectedImage!} className="max-w-full max-h-full object-contain" alt="Original" />
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded font-bold uppercase">Source</div>
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button onClick={() => { setTempImage(selectedImage); setIsCropping(true); }} className="p-1.5 bg-white dark:bg-slate-800 shadow rounded-full text-slate-600 hover:text-indigo-600"><Crop className="w-4 h-4" /></button>
                      <button onClick={reset} className="p-1.5 bg-white dark:bg-slate-800 shadow rounded-full text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="flex-1 relative bg-slate-200/50 dark:bg-slate-800/30 rounded-lg overflow-hidden border dark:border-slate-700 flex flex-col items-center justify-center">
                    {status === GenerationStatus.GENERATING ? (
                      <div className="flex flex-col items-center gap-4 text-center p-6 animate-pulse">
                        <RefreshCw className="w-16 h-16 text-indigo-600 animate-spin" />
                        <p className="font-bold dark:text-white">Generating Magic...</p>
                      </div>
                    ) : resultImages.length > 0 ? (
                      <div className="w-full h-full flex flex-col">
                        <div className="flex-1 relative bg-white dark:bg-slate-900 flex items-center justify-center p-2 group">
                          {showComparison ? (
                            <div className="relative w-full h-full overflow-hidden">
                              <img src={resultImages[selectedResultIndex]} style={{ filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)` }} className="absolute inset-0 w-full h-full object-contain" />
                              <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                                <img src={selectedImage!} className="w-full h-full object-contain bg-white dark:bg-slate-900" />
                              </div>
                              <input type="range" min="0" max="100" value={sliderPos} onChange={(e) => setSliderPos(Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 cursor-ew-resize z-10" />
                              <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl z-20 pointer-events-none" style={{ left: `${sliderPos}%` }} />
                            </div>
                          ) : (
                            <img src={resultImages[selectedResultIndex]} style={{ filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)` }} className="max-w-full max-h-full object-contain" />
                          )}
                          
                          <div className="absolute top-2 left-2 flex gap-2">
                            <span className="bg-indigo-600 text-white text-[10px] px-2 py-1 rounded font-bold uppercase">Result</span>
                            <button onClick={() => setShowComparison(!showComparison)} className={`p-1 rounded text-[10px] font-bold transition-all ${showComparison ? 'bg-orange-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}>
                              {showComparison ? 'Exit Side-by-Side' : 'Compare Before/After'}
                            </button>
                          </div>
                          
                          <div className="absolute top-2 right-2 flex gap-2">
                            <button onClick={() => toggleSaveCreation(resultImages[selectedResultIndex])} className={`p-2 rounded-full shadow-lg ${savedCreations.some(s => s.image === resultImages[selectedResultIndex]) ? 'bg-pink-500 text-white' : 'bg-white/90 dark:bg-slate-800/90 text-slate-400'}`}>
                              <Heart className={`w-5 h-5 ${savedCreations.some(s => s.image === resultImages[selectedResultIndex]) ? 'fill-white' : ''}`} />
                            </button>
                            <button onClick={() => downloadImage(resultImages[selectedResultIndex], `result.png`)} className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-full shadow-lg"><Download className="w-5 h-5" /></button>
                          </div>
                        </div>
                        <div className="h-20 bg-slate-900 dark:bg-black flex items-center gap-2 px-3 overflow-x-auto scrollbar-hide">
                          {resultImages.map((img, idx) => (
                            <button key={idx} onClick={() => setSelectedResultIndex(idx)} className={`flex-shrink-0 w-12 h-12 rounded border-2 transition-all ${selectedResultIndex === idx ? 'border-indigo-400 scale-110' : 'border-transparent opacity-60'}`}>
                              <img src={img} className="w-full h-full object-cover" />
                            </button>
                          ))}
                          <button onClick={() => setShowFilters(!showFilters)} className={`flex-shrink-0 w-12 h-12 rounded flex flex-col items-center justify-center transition-all ${showFilters ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}>
                            <SlidersHorizontal className="w-5 h-5" />
                          </button>
                        </div>
                        {showFilters && (
                          <div className="bg-white dark:bg-slate-900 border-t dark:border-slate-800 p-4 grid grid-cols-3 gap-4 animate-in slide-in-from-bottom-2">
                            {Object.entries(filters).map(([key, val]) => (
                              <div key={key} className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-400">{key}</label>
                                <input type="range" min="50" max="150" value={val} onChange={(e) => setFilters(prev => ({...prev, [key]: Number(e.target.value)}))} className="w-full h-1 accent-indigo-600" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-center flex flex-col items-center">
                        <ImageIcon className="w-12 h-12 opacity-20 mb-2" />
                        <p className="text-xs font-medium">No Scene Generated</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" /> Scene Description
                  </label>
                  <button onClick={handleSuggestPrompts} disabled={!selectedImage || status === GenerationStatus.SUGGESTING} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50">
                    <Wand2 className={`w-3 h-3 ${status === GenerationStatus.SUGGESTING ? 'animate-spin' : ''}`} /> AI Suggest
                  </button>
                </div>
                
                {aiSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 animate-in fade-in zoom-in duration-300">
                    {aiSuggestions.map((s, i) => (
                      <button key={i} onClick={() => setBackgroundPrompt(s)} className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 border border-indigo-100 dark:border-indigo-900/50 px-2 py-1 rounded-full hover:bg-indigo-100 transition-colors">
                        ✨ {s}
                      </button>
                    ))}
                  </div>
                )}

                <textarea value={backgroundPrompt} onChange={e => setBackgroundPrompt(e.target.value)} placeholder="e.g., A minimalist white marble podium with soft morning shadows..." className="w-full min-h-[100px] p-4 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" disabled={status === GenerationStatus.GENERATING} />
              </div>

              <div className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {PROMPT_CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>{cat.icon} {cat.name}</button>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {PROMPT_CATEGORIES.find(c => c.id === activeCategory)?.prompts.map((p, i) => (
                    <button key={i} onClick={() => setBackgroundPrompt(p)} className="px-3 py-2 text-left rounded-xl border dark:border-slate-800 text-[11px] font-medium bg-slate-50 dark:bg-slate-800/50 hover:border-indigo-300 text-slate-600 dark:text-slate-400 transition-all line-clamp-2">{p}</button>
                  ))}
                </div>
              </div>

              <div className="border dark:border-slate-800 rounded-xl overflow-hidden">
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 font-bold text-sm uppercase"><div className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-indigo-500" /> Advanced Settings</div> {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                {showAdvanced && (
                  <div className="p-4 space-y-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800 animate-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Temperature</span> <span className="text-indigo-500">{aiConfig.temperature.toFixed(1)}</span></div>
                      <input type="range" min="0" max="2" step="0.1" value={aiConfig.temperature} onChange={e => setAiConfig({...aiConfig, temperature: parseFloat(e.target.value)})} className="w-full accent-indigo-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Top P</span> <span className="text-indigo-500">{aiConfig.topP.toFixed(2)}</span></div>
                        <input type="range" min="0" max="1" step="0.05" value={aiConfig.topP} onChange={e => setAiConfig({...aiConfig, topP: parseFloat(e.target.value)})} className="w-full accent-indigo-600" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Top K</span> <span className="text-indigo-500">{aiConfig.topK}</span></div>
                        <input type="range" min="1" max="100" step="1" value={aiConfig.topK} onChange={e => setAiConfig({...aiConfig, topK: parseInt(e.target.value)})} className="w-full accent-indigo-600" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button disabled={!selectedImage || !backgroundPrompt || status === GenerationStatus.GENERATING} onClick={handleGenerate} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                {status === GenerationStatus.GENERATING ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {status === GenerationStatus.GENERATING ? 'Generating Scenes...' : 'Magic Generate'}
              </button>
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg border border-red-100 dark:border-red-900/30">{error}</div>}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-indigo-900 dark:bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
              <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg flex items-center gap-2"><Bookmark className="w-5 h-5 text-indigo-400" /> Saved Gallery</h3></div>
              <div className="space-y-3">
                {savedCreations.slice(0, 3).map(s => (
                  <div key={s.id} onClick={() => { setSelectedImage(s.originalImage); setBackgroundPrompt(s.prompt); setResultImages([s.image]); setSelectedResultIndex(0); }} className="flex items-center gap-3 bg-white/10 p-2 rounded-lg cursor-pointer hover:bg-white/20 transition-colors">
                    <div className="w-12 h-12 flex-shrink-0 bg-white dark:bg-slate-800 rounded overflow-hidden"><img src={s.image} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate italic opacity-80">"{s.prompt}"</p></div>
                  </div>
                ))}
                {savedCreations.length === 0 && <div className="py-8 text-center border border-dashed border-white/20 rounded-xl opacity-40"><p className="text-xs italic">Gallery is empty</p></div>}
                {savedCreations.length > 3 && <button onClick={() => { setHistoryTab('favorites'); setShowHistory(true); }} className="w-full py-2 text-xs font-bold text-indigo-200 hover:text-white transition-colors bg-white/5 rounded-lg">View all gallery items →</button>}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Pro Tips</h3>
              <ul className="space-y-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <li className="flex gap-3"><div className="w-5 h-5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold">1</div> <span><b>Comparison:</b> Use the Compare tool to see exactly how AI transformed your lighting.</span></li>
                <li className="flex gap-3"><div className="w-5 h-5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold">2</div> <span><b>Social Presets:</b> Use 9:16 for IG Story and 1:1 for main feeds to ensure best fit.</span></li>
                <li className="flex gap-3"><div className="w-5 h-5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold">3</div> <span><b>AI Suggest:</b> Let AI analyze your product's shape and color for the perfect background match.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col transform transition-transform duration-300">
            <div className="p-4 border-b dark:border-slate-800 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-xl flex items-center gap-2 text-slate-900 dark:text-white">
                  {historyTab === 'recent' ? <History className="w-5 h-5 text-indigo-500" /> : <Heart className="w-5 h-5 text-pink-500" />} 
                  {historyTab === 'recent' ? 'Recent History' : 'Saved Creations'}
                </h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500"><X /></button>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button onClick={() => setHistoryTab('recent')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${historyTab === 'recent' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>History</button>
                <button onClick={() => setHistoryTab('favorites')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${historyTab === 'favorites' ? 'bg-white dark:bg-slate-700 text-pink-600 shadow-sm' : 'text-slate-500'}`}>Saved ({savedCreations.length})</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {historyTab === 'recent' ? (
                history.map(h => (
                  <div key={h.id} onClick={() => { setSelectedImage(h.originalImage); setBackgroundPrompt(h.prompt); setResultImages(h.resultImages); setSelectedResultIndex(h.selectedImageIndex); setShowHistory(false); }} className="group bg-slate-50 dark:bg-slate-800/50 rounded-xl border dark:border-slate-800 p-2 cursor-pointer hover:border-indigo-400">
                    <img src={h.resultImages[h.selectedImageIndex]} className="aspect-video w-full object-contain bg-white dark:bg-slate-900 rounded-lg" />
                    <div className="mt-2 px-1 flex items-center justify-between"><p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(h.timestamp).toLocaleDateString()}</p><button onClick={e => { e.stopPropagation(); setHistory(prev => prev.filter(item => item.id !== h.id)); }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button></div>
                  </div>
                ))
              ) : (
                savedCreations.map(s => (
                  <div key={s.id} onClick={() => { setSelectedImage(s.originalImage); setBackgroundPrompt(s.prompt); setResultImages([s.image]); setSelectedResultIndex(0); setShowHistory(false); }} className="group bg-slate-50 dark:bg-slate-800/50 rounded-xl border dark:border-pink-900/30 p-2 cursor-pointer hover:border-pink-400">
                    <img src={s.image} className="aspect-video w-full object-contain bg-white dark:bg-slate-900 rounded-lg" />
                    <div className="mt-2 px-1 flex items-center justify-between"><p className="text-[9px] font-bold text-pink-400 uppercase">Saved</p><button onClick={e => { e.stopPropagation(); setSavedCreations(prev => prev.filter(item => item.id !== s.id)); }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="py-8 border-t dark:border-slate-800 bg-white dark:bg-slate-950 text-center text-xs text-slate-400">
        <p>Powered by Gemini 2.5 Flash Image. All data stored locally via IndexedDB.</p>
      </footer>
    </div>
  );
};

export default App;
