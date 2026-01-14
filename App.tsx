
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, Image as ImageIcon, Sparkles, History, Download, RefreshCw, 
  X, Camera, Circle, Crop, Layers, Heart, Trash2, Bookmark, 
  Sun, Moon, Box, Tent, Crown, Cpu, Coffee, Settings2, ChevronDown, ChevronUp, Info,
  Undo, Redo
} from 'lucide-react';
import Cropper, { Area } from 'react-easy-crop';
import { generateProductSceneVariations } from './services/geminiService';
import { GenerationHistory, GenerationStatus, SavedCreation, AIConfig } from './types';
import { getHistoryItems, saveHistoryItems, getFavoriteItems, saveFavoriteItems } from './services/storageService';

const PROMPT_CATEGORIES = [
  {
    id: 'minimalist',
    name: 'Minimalist',
    icon: <Box className="w-4 h-4" />,
    prompts: [
      "Clean white studio background, soft shadows, geometric pedestals, high-key lighting",
      "Soft beige textured wall, minimalist concrete platform, ethereal natural light",
      "Neutral grey backdrop, sharp shadows, Bauhaus style composition, professional product shot"
    ]
  },
  {
    id: 'luxury',
    name: 'Luxury',
    icon: <Crown className="w-4 h-4" />,
    prompts: [
      "Dark polished black marble, elegant gold accents, dramatic rim lighting, luxury boutique atmosphere",
      "Royal velvet drapery, warm spotlighting, champagne tones, high-end commercial aesthetic",
      "Art Deco interior, brass details, moody sophisticated lighting, premium brand presentation"
    ]
  },
  {
    id: 'nature',
    name: 'Nature',
    icon: <Tent className="w-4 h-4" />,
    prompts: [
      "Morning sunlight filtering through forest leaves, mossy stone surface, soft bokeh background",
      "Tropical beach setting at golden hour, driftwood textures, calm ocean waves in distance",
      "Desert dunes under a starry night sky, dramatic moonlit shadows, sand textures"
    ]
  },
  {
    id: 'futuristic',
    name: 'Futuristic',
    icon: <Cpu className="w-4 h-4" />,
    prompts: [
      "Cyberpunk neon-lit alleyway, rainy asphalt reflections, holographic displays, purple and cyan palette",
      "Clean spaceship interior, sleek metallic surfaces, blue LED lighting, sci-fi laboratory vibe",
      "Vaporwave aesthetic, 80s retro-futurism, grid floor, synthwave sunset background"
    ]
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle',
    icon: <Coffee className="w-4 h-4" />,
    prompts: [
      "Cozy wooden cabin table, fireplace glow in background, knitted textures, warm hygge atmosphere",
      "Modern bright kitchen countertop, blurred living room in background, morning coffee vibes",
      "Industrial loft workspace, brick walls, large windows with city view, creative studio setting"
    ]
  }
];

interface CropStateSnapshot {
  crop: { x: number; y: number };
  zoom: number;
  aspect: number | undefined;
}

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
  const [mimeType, setMimeType] = useState<string>('');
  const [backgroundPrompt, setBackgroundPrompt] = useState<string>('');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [variationCount, setVariationCount] = useState<number>(3);
  const [activeCategory, setActiveCategory] = useState(PROMPT_CATEGORIES[0].id);

  // Advanced AI Config
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    temperature: 1.0,
    topK: 64,
    topP: 0.95
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [storedHistory, storedFavorites] = await Promise.all([
          getHistoryItems(),
          getFavoriteItems()
        ]);
        setHistory(storedHistory);
        setSavedCreations(storedFavorites);
      } catch (err) {
        console.error("Failed to load storage:", err);
      } finally {
        setIsLoadingStorage(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!isLoadingStorage) {
      saveHistoryItems(history).catch(e => console.error("History save error:", e));
    }
  }, [history, isLoadingStorage]);

  useEffect(() => {
    if (!isLoadingStorage) {
      saveFavoriteItems(savedCreations).catch(e => console.error("Favorites save error:", e));
    }
  }, [savedCreations, isLoadingStorage]);

  // Crop History Tracking
  useEffect(() => {
    if (!isCropping) {
      setPastCrops([]);
      setFutureCrops([]);
      setStableCropState(null);
      return;
    }

    if (!stableCropState) {
      setStableCropState({ crop, zoom, aspect });
      return;
    }

    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      const currentState = { crop, zoom, aspect };
      if (JSON.stringify(currentState) !== JSON.stringify(stableCropState)) {
        setPastCrops(prev => [...prev, stableCropState]);
        setFutureCrops([]);
        setStableCropState(currentState);
      }
    }, 600); // Debounce to group drag interactions

    return () => clearTimeout(timeout);
  }, [crop, zoom, aspect, isCropping]);

  const handleUndoCrop = () => {
    if (pastCrops.length === 0) return;
    const previous = pastCrops[pastCrops.length - 1];
    const current = { crop, zoom, aspect };
    
    setFutureCrops(prev => [current, ...prev]);
    setPastCrops(prev => prev.slice(0, -1));
    
    skipHistoryRef.current = true;
    setCrop(previous.crop);
    setZoom(previous.zoom);
    setAspect(previous.aspect);
    setStableCropState(previous);
  };

  const handleRedoCrop = () => {
    if (futureCrops.length === 0) return;
    const next = futureCrops[0];
    const current = { crop, zoom, aspect };
    
    setPastCrops(prev => [...prev, current]);
    setFutureCrops(prev => prev.slice(1));
    
    skipHistoryRef.current = true;
    setCrop(next.crop);
    setZoom(next.zoom);
    setAspect(next.aspect);
    setStableCropState(next);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMimeType(file.type);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImage(reader.result as string);
        setIsCropping(true);
        // Reset crop values for new image
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setAspect(1);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraActive(true);
    } catch (err) {
      setError("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setTempImage(dataUrl);
        setMimeType('image/jpeg');
        setIsCropping(true);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setAspect(1);
        stopCamera();
      }
    }
  };

  const onCropComplete = useCallback((_a: Area, cp: Area) => setCroppedAreaPixels(cp), []);

  const handleCropSave = async () => {
    if (!tempImage || !croppedAreaPixels) return;
    try {
      const img = new Image();
      img.src = tempImage;
      await new Promise(r => img.onload = r);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      ctx.drawImage(img, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, croppedAreaPixels.width, croppedAreaPixels.height);
      setSelectedImage(canvas.toDataURL(mimeType || 'image/jpeg'));
      setResultImages([]);
      setIsCropping(false);
      setTempImage(null);
      setStatus(GenerationStatus.IDLE);
    } catch (e) {
      setError("Failed to crop image.");
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage || !backgroundPrompt) return;
    try {
      setStatus(GenerationStatus.GENERATING);
      setError(null);
      const results = await generateProductSceneVariations(selectedImage, mimeType, backgroundPrompt, variationCount, aiConfig);
      setResultImages(results);
      setSelectedResultIndex(0);
      setStatus(GenerationStatus.SUCCESS);
      const item: GenerationHistory = { id: Date.now().toString(), originalImage: selectedImage, resultImages: results, selectedImageIndex: 0, prompt: backgroundPrompt, timestamp: Date.now() };
      setHistory(prev => [item, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Failed to generate images.');
      setStatus(GenerationStatus.ERROR);
    }
  };

  const toggleSaveCreation = (img: string) => {
    const exists = savedCreations.find(s => s.image === img);
    if (exists) {
      setSavedCreations(prev => prev.filter(s => s.image !== img));
    } else {
      const newSave: SavedCreation = {
        id: Date.now().toString(),
        image: img,
        originalImage: selectedImage || '',
        prompt: backgroundPrompt,
        timestamp: Date.now(),
      };
      setSavedCreations(prev => [newSave, ...prev]);
    }
  };

  const isSaved = (img: string) => savedCreations.some(s => s.image === img);

  const reset = () => {
    setSelectedImage(null);
    setResultImages([]);
    setBackgroundPrompt('');
    setStatus(GenerationStatus.IDLE);
    setError(null);
    stopCamera();
    setIsCropping(false);
  };

  const downloadImage = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const deleteFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedCreations(prev => prev.filter(s => s.id !== id));
  };

  const activeCategoryData = PROMPT_CATEGORIES.find(c => c.id === activeCategory);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">ProductScene AI</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} mode`}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
            <button 
              onClick={() => { setHistoryTab('favorites'); setShowHistory(true); }}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
            >
              <Heart className={`w-5 h-5 ${savedCreations.length > 0 ? 'fill-pink-500 text-pink-500' : ''}`} />
              <span className="hidden sm:inline font-medium">Saved</span>
              {savedCreations.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {savedCreations.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => { setHistoryTab('recent'); setShowHistory(true); }}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
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
              {isLoadingStorage && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              )}
              
              {!selectedImage && !isCameraActive && !isCropping ? (
                <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div onClick={() => fileInputRef.current?.click()} className="group flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors p-8 text-center">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-full group-hover:scale-110 transition-transform"><Upload className="w-8 h-8 text-indigo-600 dark:text-indigo-400" /></div>
                    <p className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Upload product photo</p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG or WebP up to 10MB</p>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>
                  <div onClick={startCamera} className="group flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors p-8 text-center">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-full group-hover:scale-110 transition-transform"><Camera className="w-8 h-8 text-emerald-600 dark:text-emerald-400" /></div>
                    <p className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Take a photo</p>
                    <p className="text-xs text-slate-400 mt-1">Use your device camera</p>
                  </div>
                </div>
              ) : isCropping && tempImage ? (
                <div className="relative flex-1 bg-slate-900 flex flex-col min-h-[500px]">
                  <div className="relative flex-1">
                    <Cropper image={tempImage} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
                    
                    {/* Undo/Redo Buttons Floating */}
                    <div className="absolute top-4 left-4 flex gap-2 z-30">
                      <button 
                        onClick={handleUndoCrop} 
                        disabled={pastCrops.length === 0}
                        className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-full shadow-lg text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white transition-all"
                        title="Undo Crop Action"
                      >
                        <Undo className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={handleRedoCrop} 
                        disabled={futureCrops.length === 0}
                        className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-full shadow-lg text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white transition-all"
                        title="Redo Crop Action"
                      >
                        <Redo className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900 p-4 flex flex-col gap-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {[1, 4/3, 16/9, undefined].map(v => (
                        <button 
                          key={String(v)} 
                          onClick={() => setAspect(v)} 
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${aspect === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                        >
                          {v === 1 ? '1:1' : v === 4/3 ? '4:3' : v === 16/9 ? '16:9' : 'Free'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <button onClick={() => { setIsCropping(false); setTempImage(null); }} className="px-6 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                      <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={e => setZoom(Number(e.target.value))} className="flex-1 h-2 accent-indigo-600" />
                      <button onClick={handleCropSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95">Confirm Crop</button>
                    </div>
                  </div>
                </div>
              ) : isCameraActive ? (
                <div className="relative flex-1 bg-black flex items-center justify-center">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-6 flex gap-6">
                    <button onClick={stopCamera} className="p-3 bg-white/20 rounded-full text-white backdrop-blur-md border border-white/20"><X /></button>
                    <button onClick={capturePhoto} className="p-1 bg-white rounded-full"><Circle className="w-14 h-14 text-slate-900 fill-slate-900" /></button>
                  </div>
                </div>
              ) : (
                <div className="relative flex-1 bg-slate-100 dark:bg-slate-950 flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
                  <div className="flex-1 relative bg-white dark:bg-slate-900 rounded-lg shadow-inner overflow-hidden flex items-center justify-center p-2 border border-slate-200 dark:border-slate-800">
                    <img src={selectedImage!} className="max-w-full max-h-full object-contain" alt="Original" />
                    <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">Source</div>
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button onClick={() => { setTempImage(selectedImage); setIsCropping(true); }} className="p-1.5 bg-white dark:bg-slate-800 shadow rounded-full text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><Crop className="w-4 h-4" /></button>
                      <button onClick={reset} className="p-1.5 bg-white dark:bg-slate-800 shadow rounded-full text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="flex-1 relative bg-slate-200/50 dark:bg-slate-800/30 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center">
                    {status === GenerationStatus.GENERATING ? (
                      <div className="flex flex-col items-center gap-4 text-center p-6">
                        <div className="relative">
                          <RefreshCw className="w-16 h-16 text-indigo-600 dark:text-indigo-400 animate-spin" />
                          <Sparkles className="absolute top-0 right-0 w-6 h-6 text-indigo-400 dark:text-indigo-600 animate-pulse" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-lg">Reimagining Scenes</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Generating {variationCount} artistic variations for you...</p>
                        </div>
                      </div>
                    ) : resultImages.length > 0 ? (
                      <div className="w-full h-full flex flex-col">
                        <div className="flex-1 relative bg-white dark:bg-slate-900 flex items-center justify-center p-2">
                          <img src={resultImages[selectedResultIndex]} className="max-w-full max-h-full object-contain" alt="Result" />
                          <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded font-bold">V{selectedResultIndex + 1} / {resultImages.length}</div>
                          <div className="absolute top-2 right-2 flex gap-2">
                            <button 
                              onClick={() => toggleSaveCreation(resultImages[selectedResultIndex])}
                              className={`p-2 rounded-full shadow-lg transition-all ${isSaved(resultImages[selectedResultIndex]) ? 'bg-pink-500 text-white' : 'bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-pink-500'}`}
                            >
                              <Heart className={`w-5 h-5 ${isSaved(resultImages[selectedResultIndex]) ? 'fill-white' : ''}`} />
                            </button>
                            <button onClick={() => downloadImage(resultImages[selectedResultIndex], `product-scene.png`)} className="p-2 bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white rounded-full shadow-lg"><Download className="w-5 h-5" /></button>
                          </div>
                        </div>
                        <div className="h-20 bg-slate-900 dark:bg-black flex items-center gap-2 px-3 overflow-x-auto scrollbar-hide">
                          {resultImages.map((img, idx) => (
                            <button key={idx} onClick={() => setSelectedResultIndex(idx)} className={`flex-shrink-0 w-12 h-12 rounded border-2 transition-all ${selectedResultIndex === idx ? 'border-indigo-400 scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                              <img src={img} className="w-full h-full object-cover rounded-[1px]" />
                            </button>
                          ))}
                          <button onClick={handleGenerate} className="flex-shrink-0 w-12 h-12 bg-white/10 rounded flex flex-col items-center justify-center text-white/50 hover:bg-white/20 transition-colors"><RefreshCw className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-400 dark:text-slate-600 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                          <ImageIcon className="w-8 h-8 opacity-40" />
                        </div>
                        <p className="text-sm font-medium">No Scene Generated Yet</p>
                        <p className="text-[10px] mt-1 opacity-60">Complete the prompt to start</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Variation Batch Size
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  {[3, 4, 5].map(n => (
                    <button 
                      key={n} 
                      onClick={() => setVariationCount(n)} 
                      className={`px-4 py-1 rounded-md text-xs font-bold transition-all ${variationCount === n ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Scene Description
                </label>
                <textarea 
                  value={backgroundPrompt} 
                  onChange={e => setBackgroundPrompt(e.target.value)} 
                  placeholder="e.g., A minimalist white marble podium with soft morning shadows..." 
                  className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors" 
                  disabled={status === GenerationStatus.GENERATING}
                />
              </div>

              <div className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {PROMPT_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                    >
                      {cat.icon}
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activeCategoryData?.prompts.map((p, i) => (
                    <button 
                      key={i} 
                      onClick={() => setBackgroundPrompt(p)} 
                      className="px-3 py-2 text-left rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] font-medium bg-slate-50 dark:bg-slate-800/50 hover:border-indigo-300 dark:hover:border-indigo-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all line-clamp-2"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Settings Section */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all">
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider">
                    <Settings2 className="w-4 h-4 text-indigo-500" />
                    Advanced AI Settings
                  </div>
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showAdvanced && (
                  <div className="p-4 space-y-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                          Temperature
                          <div className="group relative">
                            <Info className="w-3 h-3 cursor-help text-slate-400" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                              Controls randomness. Lower values are more predictable, higher values are more creative.
                            </div>
                          </div>
                        </label>
                        <span className="text-xs font-mono font-bold text-indigo-500">{aiConfig.temperature.toFixed(1)}</span>
                      </div>
                      <input 
                        type="range" min="0" max="2" step="0.1" 
                        value={aiConfig.temperature} 
                        onChange={e => setAiConfig({...aiConfig, temperature: parseFloat(e.target.value)})}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                            Top P
                            <div className="group relative">
                              <Info className="w-3 h-3 cursor-help text-slate-400" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                Nucleus sampling. Limits choices to a percentage of total probability.
                              </div>
                            </div>
                          </label>
                          <span className="text-xs font-mono font-bold text-indigo-500">{aiConfig.topP.toFixed(2)}</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.05" 
                          value={aiConfig.topP} 
                          onChange={e => setAiConfig({...aiConfig, topP: parseFloat(e.target.value)})}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                            Top K
                            <div className="group relative">
                              <Info className="w-3 h-3 cursor-help text-slate-400" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                Limits the pool of tokens to the top K most likely ones.
                              </div>
                            </div>
                          </label>
                          <span className="text-xs font-mono font-bold text-indigo-500">{aiConfig.topK}</span>
                        </div>
                        <input 
                          type="range" min="1" max="100" step="1" 
                          value={aiConfig.topK} 
                          onChange={e => setAiConfig({...aiConfig, topK: parseInt(e.target.value)})}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button 
                disabled={!selectedImage || !backgroundPrompt || status === GenerationStatus.GENERATING} 
                onClick={handleGenerate} 
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
              >
                {status === GenerationStatus.GENERATING ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {status === GenerationStatus.GENERATING ? 'Magically Generating...' : 'Generate New Scenes'}
              </button>
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30">{error}</div>}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-indigo-900 dark:bg-slate-900 rounded-2xl p-6 text-white border border-transparent dark:border-indigo-500/20 shadow-xl shadow-indigo-900/10 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Bookmark className="w-5 h-5 text-indigo-400" />Saved Gallery</h3>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{savedCreations.length} items</span>
              </div>
              <div className="space-y-3">
                {savedCreations.slice(0, 3).map(s => (
                  <div key={s.id} onClick={() => { setSelectedImage(s.originalImage); setBackgroundPrompt(s.prompt); setResultImages([s.image]); setSelectedResultIndex(0); }} className="flex items-center gap-3 bg-white/10 dark:bg-white/5 p-2 rounded-lg group cursor-pointer hover:bg-white/20 dark:hover:bg-white/10 transition-colors">
                    <div className="w-12 h-12 flex-shrink-0 bg-white dark:bg-slate-800 rounded overflow-hidden">
                      <img src={s.image} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-indigo-300 dark:text-indigo-400 uppercase font-bold tracking-wider">Favorite</p>
                      <p className="text-xs font-medium truncate italic opacity-80">"{s.prompt}"</p>
                    </div>
                  </div>
                ))}
                {savedCreations.length === 0 && (
                  <div className="py-8 text-center border border-dashed border-white/20 rounded-xl">
                    <Heart className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    <p className="text-xs text-indigo-300 italic opacity-50 px-4">Save generated variations to see them here.</p>
                  </div>
                )}
                {savedCreations.length > 3 && (
                  <button onClick={() => { setHistoryTab('favorites'); setShowHistory(true); }} className="w-full py-2 text-xs font-bold text-indigo-200 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg">View all gallery items →</button>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm transition-colors duration-300">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Pro Tips</h3>
              <ul className="space-y-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <li className="flex gap-3">
                  <div className="w-5 h-5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex-shrink-0 flex items-center justify-center font-bold">1</div>
                  <span><b>Undo/Redo:</b> Fine-tune your crop with the floating history buttons in the editor.</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-5 h-5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex-shrink-0 flex items-center justify-center font-bold">2</div>
                  <span><b>Be Specific:</b> Use descriptive words like "Golden hour", "Polished", or "Soft focus".</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-5 h-5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex-shrink-0 flex items-center justify-center font-bold">3</div>
                  <span><b>Tight Crop:</b> Always ensure your product fills the frame for the best extraction.</span>
                </li>
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
                <button onClick={() => setHistoryTab('recent')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${historyTab === 'recent' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-500'}`}>Recent History</button>
                <button onClick={() => setHistoryTab('favorites')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${historyTab === 'favorites' ? 'bg-white dark:bg-slate-700 text-pink-600 dark:text-pink-300 shadow-sm' : 'text-slate-500 dark:text-slate-500'}`}>Gallery ({savedCreations.length})</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {historyTab === 'recent' ? (
                history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <History className="w-12 h-12 opacity-10 mb-4" />
                    <p className="text-sm">No generations found</p>
                  </div>
                ) :
                history.map(h => (
                  <div key={h.id} onClick={() => { setSelectedImage(h.originalImage); setBackgroundPrompt(h.prompt); setResultImages(h.resultImages); setSelectedResultIndex(h.selectedImageIndex); setShowHistory(false); }} className="group bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 p-2 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-all">
                    <div className="aspect-video relative bg-white dark:bg-slate-900 rounded-lg overflow-hidden border dark:border-slate-800">
                      <img src={h.resultImages[h.selectedImageIndex]} className="w-full h-full object-contain" />
                      <button onClick={e => deleteHistoryItem(h.id, e)} className="absolute top-2 right-2 p-1.5 bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    <div className="mt-2 px-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{new Date(h.timestamp).toLocaleDateString()}</p>
                        <span className="text-[9px] font-bold text-indigo-500">{h.resultImages.length} Var</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 italic line-clamp-1">"{h.prompt}"</p>
                    </div>
                  </div>
                ))
              ) : (
                savedCreations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Heart className="w-12 h-12 opacity-10 mb-4" />
                    <p className="text-sm">Gallery is empty</p>
                  </div>
                ) :
                savedCreations.map(s => (
                  <div key={s.id} onClick={() => { setSelectedImage(s.originalImage); setBackgroundPrompt(s.prompt); setResultImages([s.image]); setSelectedResultIndex(0); setShowHistory(false); }} className="group bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-pink-100 dark:border-pink-900/30 p-2 cursor-pointer hover:border-pink-400 dark:hover:border-pink-500 transition-all">
                    <div className="aspect-video relative bg-white dark:bg-slate-900 rounded-lg overflow-hidden border dark:border-slate-800">
                      <img src={s.image} className="w-full h-full object-contain" />
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={e => { e.stopPropagation(); downloadImage(s.image, 'saved-scene.png'); }} className="p-1.5 bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 rounded-full shadow-sm hover:text-indigo-600"><Download className="w-3 h-3" /></button>
                        <button onClick={e => deleteFavorite(s.id, e)} className="p-1.5 bg-white/90 dark:bg-slate-800/90 text-pink-500 rounded-full shadow-sm"><Heart className="w-3 h-3 fill-pink-500" /></button>
                      </div>
                    </div>
                    <div className="mt-2 px-1">
                      <p className="text-[9px] font-bold text-pink-400 dark:text-pink-500 uppercase mb-1">Saved Favorite</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 italic line-clamp-1">"{s.prompt}"</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="py-8 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-center text-xs text-slate-400 dark:text-slate-600 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>Powered by Gemini 2.5 Flash Image. Secure local storage.</p>
          <div className="flex gap-4">
            <span className="hover:text-indigo-500 cursor-pointer">Terms</span>
            <span className="hover:text-indigo-500 cursor-pointer">Privacy</span>
            <span className="hover:text-indigo-500 cursor-pointer">Help</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
