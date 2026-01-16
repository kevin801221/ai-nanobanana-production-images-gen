
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, ImageIcon, Sparkles, History, Download, RefreshCw, 
  X, Camera, Circle, Crop, Layers, Heart, Trash2, Bookmark, 
  Sun, Moon, Box, Tent, Crown, Cpu, Coffee, Settings2, ChevronDown, ChevronUp, Info,
  Undo, Redo, Wand2, Maximize2, SlidersHorizontal, Instagram, Facebook, Tv,
  Video, Play, MessageSquarePlus, Send, Loader2, Eraser, PenTool, Palette, Plus, Check
} from 'lucide-react';
import Cropper, { Area } from 'react-easy-crop';
import { generateProductSceneVariations, suggestPrompts, refinePromptWithInstruction, generateProductVideo, eraseObjectFromImage } from './services/geminiService';
import { GenerationHistory, GenerationStatus, SavedCreation, AIConfig, ImageFilters, BrandKit } from './types';
import { getHistoryItems, saveHistoryItems, getFavoriteItems, saveFavoriteItems, saveBrandKit, getBrandKit } from './services/storageService';

const PROMPT_CATEGORIES = [
  { id: 'minimalist', name: 'Minimalist', icon: <Box className="w-4 h-4" />, prompts: ["Clean white studio background, soft shadows, geometric pedestals", "Soft beige textured wall, minimalist concrete platform"] },
  { id: 'luxury', name: 'Luxury', icon: <Crown className="w-4 h-4" />, prompts: ["Dark polished black marble, elegant gold accents", "Royal velvet drapery, warm spotlighting"] },
  { id: 'nature', name: 'Nature', icon: <Tent className="w-4 h-4" />, prompts: ["Morning sunlight through forest leaves, mossy stone", "Tropical beach setting at golden hour"] },
  { id: 'futuristic', name: 'Futuristic', icon: <Cpu className="w-4 h-4" />, prompts: ["Cyberpunk neon-lit alleyway, purple and cyan palette", "Clean spaceship interior, sleek metallic surfaces"] },
  { id: 'lifestyle', name: 'Lifestyle', icon: <Coffee className="w-4 h-4" />, prompts: ["Cozy wooden cabin table, warm hygge atmosphere", "Modern bright kitchen countertop"] }
];

interface CropStateSnapshot { crop: { x: number; y: number }; zoom: number; aspect: number | undefined; }

interface DrawingPoint { x: number; y: number; dragging: boolean; size: number; }

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ps_theme');
    return (saved as 'light' | 'dark') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [savedCreations, setSavedCreations] = useState<SavedCreation[]>([]);
  const [brandKit, setBrandKit] = useState<BrandKit>({ isEnabled: false, logoImage: null, colors: ['#000000', '#FFFFFF'], brandVoice: 'Professional', fontStyle: 'Modern Sans' });
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [backgroundPrompt, setBackgroundPrompt] = useState<string>('');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | undefined>(undefined);
  
  const [variationCount, setVariationCount] = useState<number>(3);
  const [activeCategory, setActiveCategory] = useState(PROMPT_CATEGORIES[0].id);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [refineInstruction, setRefineInstruction] = useState('');

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
  const [showBrandKit, setShowBrandKit] = useState(false);
  const [showLogoOverlay, setShowLogoOverlay] = useState(false);

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

  // Eraser States
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [eraserPaths, setEraserPaths] = useState<DrawingPoint[][]>([]);
  const eraserCanvasRef = useRef<HTMLCanvasElement>(null);
  const eraserContainerRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
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
        const [storedHistory, storedFavorites, storedBrandKit] = await Promise.all([
            getHistoryItems(), 
            getFavoriteItems(),
            getBrandKit()
        ]);
        setHistory(storedHistory);
        setSavedCreations(storedFavorites);
        if (storedBrandKit) setBrandKit(storedBrandKit);
      } catch (err) { console.error(err); } finally { setIsLoadingStorage(false); }
    };
    loadInitialData();
  }, []);

  useEffect(() => { if (!isLoadingStorage) saveHistoryItems(history); }, [history, isLoadingStorage]);
  useEffect(() => { if (!isLoadingStorage) saveFavoriteItems(savedCreations); }, [savedCreations, isLoadingStorage]);
  useEffect(() => { if (!isLoadingStorage) saveBrandKit(brandKit); }, [brandKit, isLoadingStorage]);

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

  // Redraw eraser canvas when paths change or mode is active
  useEffect(() => {
    if (!isEraserMode || !eraserCanvasRef.current || !resultImages[selectedResultIndex]) return;
    
    const canvas = eraserCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load image to set canvas dimensions correctly
    const img = new Image();
    img.src = resultImages[selectedResultIndex];
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      eraserPaths.forEach(path => {
        if (path.length < 1) return;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; // Red semi-transparent
        ctx.lineWidth = path[0].size;
        ctx.moveTo(path[0].x, path[0].y);
        for(let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
      });
    };
  }, [isEraserMode, eraserPaths, selectedResultIndex, resultImages]);

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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setBrandKit(prev => ({ ...prev, logoImage: reader.result as string })); };
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
      setStatus(GenerationStatus.GENERATING); setError(null); setCurrentVideoUrl(undefined);
      // Pass brandKit to generation service
      const results = await generateProductSceneVariations(selectedImage, mimeType, backgroundPrompt, variationCount, aiConfig, brandKit);
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

  const handleRefinePrompt = async () => {
    if (!refineInstruction || !backgroundPrompt) return;
    try {
      setStatus(GenerationStatus.REFINING);
      const newPrompt = await refinePromptWithInstruction(backgroundPrompt, refineInstruction);
      setBackgroundPrompt(newPrompt);
      setRefineInstruction('');
      // Auto trigger generation after refinement
      setStatus(GenerationStatus.GENERATING);
      const results = await generateProductSceneVariations(selectedImage!, mimeType, newPrompt, variationCount, aiConfig, brandKit);
      setResultImages(results); setSelectedResultIndex(0); setStatus(GenerationStatus.SUCCESS);
      setHistory(prev => [{ id: Date.now().toString(), originalImage: selectedImage!, resultImages: results, selectedImageIndex: 0, prompt: newPrompt, timestamp: Date.now() }, ...prev]);
    } catch (e) { setStatus(GenerationStatus.IDLE); setError("Failed to refine prompt"); }
  };

  const handleGenerateVideo = async () => {
    const currentImage = resultImages[selectedResultIndex];
    if (!currentImage) return;

    if (window.aistudio) {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
      } catch (e) {
        console.error("API Key selection cancelled or failed", e);
        return;
      }
    }

    try {
      setStatus(GenerationStatus.GENERATING_VIDEO);
      const videoUrl = await generateProductVideo(currentImage, backgroundPrompt, brandKit);
      setCurrentVideoUrl(videoUrl);
      setStatus(GenerationStatus.SUCCESS);
      
      setHistory(prev => {
        const newHistory = [...prev];
        if (newHistory[0]) {
           newHistory[0] = { ...newHistory[0], videoUrl };
        }
        return newHistory;
      });
    } catch (e: any) {
      setError(e.message || "Failed to generate video");
      setStatus(GenerationStatus.SUCCESS);
    }
  };

  const handleEraseStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEraserMode || !eraserCanvasRef.current) return;
    if (e.type === 'touchstart') e.preventDefault();

    const canvas = eraserCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    setEraserPaths(prev => [...prev, [{ x, y, dragging: true, size: brushSize }]]);
  };

  const handleEraseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEraserMode || !eraserCanvasRef.current) return;
    const lastPath = eraserPaths[eraserPaths.length - 1];
    if (!lastPath || !lastPath[lastPath.length - 1].dragging) return;
    if (e.type === 'touchmove') e.preventDefault();
    
    const canvas = eraserCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const newPaths = [...eraserPaths];
    newPaths[newPaths.length - 1].push({ x, y, dragging: true, size: brushSize });
    setEraserPaths(newPaths);
  };

  const handleEraseEnd = () => {
     if (!isEraserMode || eraserPaths.length === 0) return;
     const newPaths = [...eraserPaths];
     const lastPath = newPaths[newPaths.length - 1];
     if (lastPath && lastPath.length > 0) {
        lastPath[lastPath.length - 1].dragging = false;
        setEraserPaths(newPaths);
     }
  };

  const handleApplyEraser = async () => {
    if (eraserPaths.length === 0 || !resultImages[selectedResultIndex]) return;
    try {
      setStatus(GenerationStatus.ERASING);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx || !eraserCanvasRef.current) return;

      canvas.width = eraserCanvasRef.current.width;
      canvas.height = eraserCanvasRef.current.height;

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'white';
      
      eraserPaths.forEach(path => {
        if (path.length < 1) return;
        ctx.beginPath();
        ctx.lineWidth = path[0].size;
        ctx.moveTo(path[0].x, path[0].y);
        for(let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
      });

      const maskDataUrl = canvas.toDataURL('image/png');
      const originalResult = resultImages[selectedResultIndex];
      const newImage = await eraseObjectFromImage(originalResult, maskDataUrl);

      setResultImages(prev => { const updated = [...prev]; updated[selectedResultIndex] = newImage; return updated; });
      setHistory(prev => {
         const newHistory = [...prev];
         if (newHistory.length > 0 && newHistory[0].id === history[0].id) {
            const updatedResults = [...newHistory[0].resultImages];
            updatedResults[selectedResultIndex] = newImage;
            newHistory[0] = { ...newHistory[0], resultImages: updatedResults };
         }
         return newHistory;
      });

      setIsEraserMode(false);
      setEraserPaths([]);
      setStatus(GenerationStatus.SUCCESS);
    } catch (e: any) {
      setError("Eraser failed: " + e.message);
      setStatus(GenerationStatus.SUCCESS);
    }
  };

  const toggleSaveCreation = (img: string) => {
    const exists = savedCreations.find(s => s.image === img);
    if (exists) setSavedCreations(prev => prev.filter(s => s.image !== img));
    else setSavedCreations(prev => [{ id: Date.now().toString(), image: img, originalImage: selectedImage || '', prompt: backgroundPrompt, timestamp: Date.now(), videoUrl: currentVideoUrl }, ...prev]);
  };

  const reset = () => { setSelectedImage(null); setResultImages([]); setBackgroundPrompt(''); setStatus(GenerationStatus.IDLE); setError(null); stopCamera(); setIsCropping(false); setAiSuggestions([]); setShowComparison(false); setCurrentVideoUrl(undefined); setIsEraserMode(false); setEraserPaths([]); };

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
             <button onClick={() => setShowBrandKit(true)} className={`hidden md:flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg transition-all ${brandKit.isEnabled ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <Palette className="w-4 h-4" />
                <span className="hidden lg:inline">Brand Kit</span>
                {brandKit.isEnabled && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />}
             </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
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
                    {status === GenerationStatus.GENERATING || status === GenerationStatus.GENERATING_VIDEO || status === GenerationStatus.ERASING || status === GenerationStatus.REFINING ? (
                      <div className="flex flex-col items-center gap-4 text-center p-6 animate-pulse">
                        {status === GenerationStatus.GENERATING_VIDEO ? <Video className="w-16 h-16 text-indigo-600 animate-bounce" /> : 
                         status === GenerationStatus.ERASING ? <Eraser className="w-16 h-16 text-indigo-600 animate-pulse" /> :
                         <RefreshCw className="w-16 h-16 text-indigo-600 animate-spin" />}
                        <p className="font-bold dark:text-white">
                          {status === GenerationStatus.GENERATING_VIDEO ? 'Rendering Cinematic Video...' : 
                           status === GenerationStatus.ERASING ? 'Erasing Object...' :
                           status === GenerationStatus.REFINING ? 'Refining Prompt...' : 'Generating Scenes...'}
                        </p>
                      </div>
                    ) : resultImages.length > 0 ? (
                      <div className="w-full h-full flex flex-col">
                        <div className="flex-1 relative bg-white dark:bg-slate-900 flex items-center justify-center p-2 group overflow-hidden">
                          {currentVideoUrl ? (
                            <div className="relative w-full h-full flex items-center justify-center bg-black">
                              <video src={currentVideoUrl} controls autoPlay loop className="max-w-full max-h-full" />
                              <button onClick={() => setCurrentVideoUrl(undefined)} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full"><X className="w-4 h-4" /></button>
                            </div>
                          ) : isEraserMode ? (
                            <div 
                                className="relative w-full h-full flex items-center justify-center cursor-crosshair touch-none"
                                ref={eraserContainerRef}
                                onMouseDown={handleEraseStart}
                                onMouseMove={handleEraseMove}
                                onMouseUp={handleEraseEnd}
                                onMouseLeave={handleEraseEnd}
                                onTouchStart={handleEraseStart}
                                onTouchMove={handleEraseMove}
                                onTouchEnd={handleEraseEnd}
                            >
                                <img 
                                    src={resultImages[selectedResultIndex]} 
                                    className="max-w-full max-h-full object-contain pointer-events-none" 
                                    style={{ opacity: 0.8 }}
                                />
                                <canvas 
                                    ref={eraserCanvasRef}
                                    className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
                                    style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
                                />
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-xs font-bold pointer-events-none">
                                    Eraser Mode: Paint over areas to remove
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg border dark:border-slate-700">
                                    <button onClick={() => {setIsEraserMode(false); setEraserPaths([]);}} className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs">Cancel</button>
                                    <div className="flex items-center gap-2 px-2 border-x dark:border-slate-700">
                                        <Circle className="w-3 h-3" />
                                        <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-20 accent-indigo-600" />
                                    </div>
                                    <button onClick={() => setEraserPaths(prev => prev.slice(0, -1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><Undo className="w-4 h-4" /></button>
                                    <button onClick={handleApplyEraser} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-lg">Apply Eraser</button>
                                </div>
                            </div>
                          ) : (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <img src={resultImages[selectedResultIndex]} style={{ filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)` }} className="max-w-full max-h-full object-contain" />
                                {showLogoOverlay && brandKit.isEnabled && brandKit.logoImage && (
                                    <img 
                                        src={brandKit.logoImage} 
                                        className="absolute bottom-4 right-4 w-20 h-auto opacity-80 pointer-events-none drop-shadow-lg"
                                        alt="Brand Logo"
                                    />
                                )}
                                {showComparison && (
                                    <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                                        <img src={selectedImage!} className="w-full h-full object-contain bg-white dark:bg-slate-900" />
                                        <input type="range" min="0" max="100" value={sliderPos} onChange={(e) => setSliderPos(Number(e.target.value))} className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 cursor-ew-resize z-10 pointer-events-auto" />
                                        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl z-20 pointer-events-none" style={{ left: `${sliderPos}%` }} />
                                    </div>
                                )}
                            </div>
                          )}
                          
                          {!currentVideoUrl && !isEraserMode && (
                            <>
                              <div className="absolute top-2 left-2 flex gap-2">
                                <span className="bg-indigo-600 text-white text-[10px] px-2 py-1 rounded font-bold uppercase">Result</span>
                                <button onClick={() => setShowComparison(!showComparison)} className={`p-1 rounded text-[10px] font-bold transition-all ${showComparison ? 'bg-orange-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}>
                                  {showComparison ? 'Exit Compare' : 'Compare'}
                                </button>
                              </div>
                              
                              <div className="absolute top-2 right-2 flex gap-2">
                                <button onClick={() => toggleSaveCreation(resultImages[selectedResultIndex])} className={`p-2 rounded-full shadow-lg ${savedCreations.some(s => s.image === resultImages[selectedResultIndex]) ? 'bg-pink-500 text-white' : 'bg-white/90 dark:bg-slate-800/90 text-slate-400'}`}>
                                  <Heart className={`w-5 h-5 ${savedCreations.some(s => s.image === resultImages[selectedResultIndex]) ? 'fill-white' : ''}`} />
                                </button>
                                <button onClick={() => downloadImage(resultImages[selectedResultIndex], `result.png`)} className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-full shadow-lg"><Download className="w-5 h-5" /></button>
                              </div>

                              <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                                {brandKit.isEnabled && brandKit.logoImage && (
                                    <button onClick={() => setShowLogoOverlay(!showLogoOverlay)} className={`flex items-center gap-2 px-4 py-2 backdrop-blur font-bold rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-300 delay-100 ${showLogoOverlay ? 'bg-indigo-600 text-white' : 'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200'}`}>
                                        <Crown className="w-4 h-4" /> Toggle Logo
                                    </button>
                                )}
                                <button onClick={() => setIsEraserMode(true)} className="flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur text-slate-700 dark:text-slate-200 font-bold rounded-full shadow-lg hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-300 delay-75">
                                    <Eraser className="w-4 h-4" /> AI Eraser
                                </button>
                                <button onClick={handleGenerateVideo} className="flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur text-indigo-600 dark:text-indigo-400 font-bold rounded-full shadow-lg hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-300">
                                    <Video className="w-4 h-4" /> Animate (Veo)
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="h-20 bg-slate-900 dark:bg-black flex items-center gap-2 px-3 overflow-x-auto scrollbar-hide">
                          {resultImages.map((img, idx) => (
                            <button key={idx} onClick={() => { setSelectedResultIndex(idx); setCurrentVideoUrl(undefined); setIsEraserMode(false); }} className={`flex-shrink-0 w-12 h-12 rounded border-2 transition-all ${selectedResultIndex === idx ? 'border-indigo-400 scale-110' : 'border-transparent opacity-60'}`}>
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
                        
                        {!isEraserMode && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t dark:border-slate-700 flex gap-2">
                          <div className="flex-1 relative">
                            <MessageSquarePlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              type="text" 
                              value={refineInstruction}
                              onChange={(e) => setRefineInstruction(e.target.value)}
                              placeholder="Magic Refine: 'Make it darker', 'Add snow', 'Change floor to wood'..." 
                              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                              onKeyDown={(e) => e.key === 'Enter' && handleRefinePrompt()}
                            />
                          </div>
                          <button 
                            onClick={handleRefinePrompt}
                            disabled={!refineInstruction || status === GenerationStatus.REFINING}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {status === GenerationStatus.REFINING ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                          </button>
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

              {/* Brand Kit Indicator */}
              {brandKit.isEnabled && (
                 <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                     <div className="flex items-center gap-2">
                         <Palette className="w-4 h-4 text-indigo-600" />
                         <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Active Brand Kit:</span>
                         <div className="flex -space-x-1">
                             {brandKit.colors.map((c, i) => (
                                 <div key={i} className="w-3 h-3 rounded-full border border-white dark:border-slate-800" style={{ backgroundColor: c }} />
                             ))}
                         </div>
                         <span className="text-[10px] opacity-70">({brandKit.brandVoice})</span>
                     </div>
                     <button onClick={() => setShowBrandKit(true)} className="text-[10px] text-indigo-600 underline font-bold">Edit</button>
                 </div>
              )}

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
                  <div key={s.id} onClick={() => { setSelectedImage(s.originalImage); setBackgroundPrompt(s.prompt); setResultImages([s.image]); setSelectedResultIndex(0); if(s.videoUrl) setCurrentVideoUrl(s.videoUrl); }} className="flex items-center gap-3 bg-white/10 p-2 rounded-lg cursor-pointer hover:bg-white/20 transition-colors">
                    <div className="w-12 h-12 flex-shrink-0 bg-white dark:bg-slate-800 rounded overflow-hidden relative">
                      <img src={s.image} className="w-full h-full object-cover" />
                      {s.videoUrl && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Video className="w-4 h-4 text-white" /></div>}
                    </div>
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
                <li className="flex gap-3"><div className="w-5 h-5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold">1</div> <span><b>Brand Kit:</b> Upload your logo and set colors to ensure every generated image aligns with your brand identity.</span></li>
                <li className="flex gap-3"><div className="w-5 h-5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold">2</div> <span><b>Magic Refine:</b> Don't rewrite the whole prompt. Just type "Add a coffee cup" and let AI handle it.</span></li>
                <li className="flex gap-3"><div className="w-5 h-5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold">3</div> <span><b>AI Eraser:</b> Use the eraser tool to remove unwanted artifacts or objects. The AI will fill in the background automatically.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Brand Kit Modal */}
      {showBrandKit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
                      <h2 className="text-lg font-bold flex items-center gap-2 dark:text-white"><Palette className="w-5 h-5 text-indigo-600" /> Brand Kit</h2>
                      <button onClick={() => setShowBrandKit(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 space-y-6">
                      <div className="flex items-center gap-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                          <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={brandKit.isEnabled} onChange={(e) => setBrandKit(prev => ({ ...prev, isEnabled: e.target.checked }))} className="sr-only peer" />
                              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                              <span className="ml-3 text-sm font-bold text-slate-700 dark:text-slate-200">Enable Brand Kit</span>
                          </label>
                      </div>

                      <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-slate-500">Brand Logo</label>
                          <div className="flex items-center gap-4">
                              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden relative group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                                  {brandKit.logoImage ? (
                                      <img src={brandKit.logoImage} className="w-full h-full object-contain p-1" />
                                  ) : (
                                      <Upload className="w-6 h-6 text-slate-400" />
                                  )}
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-xs text-white font-bold">Change</span></div>
                              </div>
                              <div className="flex-1">
                                  <p className="text-xs text-slate-500 mb-2">Upload a transparent PNG logo. You can toggle this as an overlay on generated images.</p>
                                  <input type="file" ref={logoInputRef} className="hidden" accept="image/png" onChange={handleLogoUpload} />
                                  <button onClick={() => logoInputRef.current?.click()} className="text-xs font-bold text-indigo-600 border border-indigo-200 px-3 py-1 rounded hover:bg-indigo-50">Upload Logo</button>
                                  {brandKit.logoImage && <button onClick={() => setBrandKit(prev => ({...prev, logoImage: null}))} className="ml-2 text-xs text-red-500 hover:text-red-700">Remove</button>}
                              </div>
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-slate-500">Brand Colors</label>
                          <div className="flex flex-wrap gap-2">
                              {brandKit.colors.map((color, index) => (
                                  <div key={index} className="relative group">
                                      <div className="w-10 h-10 rounded-full border shadow-sm cursor-pointer" style={{ backgroundColor: color }} />
                                      <button onClick={() => setBrandKit(prev => ({ ...prev, colors: prev.colors.filter((_, i) => i !== index) }))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                                  </div>
                              ))}
                              {brandKit.colors.length < 5 && (
                                  <label className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-indigo-400 text-slate-400 hover:text-indigo-500">
                                      <Plus className="w-4 h-4" />
                                      <input type="color" className="opacity-0 absolute w-0 h-0" onChange={(e) => setBrandKit(prev => ({ ...prev, colors: [...prev.colors, e.target.value] }))} />
                                  </label>
                              )}
                          </div>
                          <p className="text-xs text-slate-500">Add up to 5 primary brand colors.</p>
                      </div>

                      <div className="space-y-2">
                          <label className="text-xs font-bold uppercase text-slate-500">Brand Voice & Style</label>
                          <input type="text" value={brandKit.brandVoice} onChange={(e) => setBrandKit(prev => ({ ...prev, brandVoice: e.target.value }))} className="w-full px-3 py-2 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm" placeholder="e.g. Minimalist, Corporate, Playful..." />
                      </div>
                  </div>
                  <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-b-2xl flex justify-end">
                      <button onClick={() => setShowBrandKit(false)} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Done</button>
                  </div>
              </div>
          </div>
      )}

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
                  <div key={h.id} onClick={() => { setSelectedImage(h.originalImage); setBackgroundPrompt(h.prompt); setResultImages(h.resultImages); setSelectedResultIndex(h.selectedImageIndex); if(h.videoUrl) setCurrentVideoUrl(h.videoUrl); setShowHistory(false); }} className="group bg-slate-50 dark:bg-slate-800/50 rounded-xl border dark:border-slate-800 p-2 cursor-pointer hover:border-indigo-400">
                    <div className="aspect-video w-full bg-white dark:bg-slate-900 rounded-lg relative overflow-hidden">
                       <img src={h.resultImages[h.selectedImageIndex]} className="w-full h-full object-contain" />
                       {h.videoUrl && <div className="absolute top-2 right-2 bg-indigo-600 p-1 rounded-full"><Video className="w-3 h-3 text-white" /></div>}
                    </div>
                    <div className="mt-2 px-1 flex items-center justify-between"><p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(h.timestamp).toLocaleDateString()}</p><button onClick={e => { e.stopPropagation(); setHistory(prev => prev.filter(item => item.id !== h.id)); }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button></div>
                  </div>
                ))
              ) : (
                savedCreations.map(s => (
                  <div key={s.id} onClick={() => { setSelectedImage(s.originalImage); setBackgroundPrompt(s.prompt); setResultImages([s.image]); setSelectedResultIndex(0); if(s.videoUrl) setCurrentVideoUrl(s.videoUrl); setShowHistory(false); }} className="group bg-slate-50 dark:bg-slate-800/50 rounded-xl border dark:border-pink-900/30 p-2 cursor-pointer hover:border-pink-400">
                    <div className="aspect-video w-full bg-white dark:bg-slate-900 rounded-lg relative overflow-hidden">
                       <img src={s.image} className="w-full h-full object-contain" />
                       {s.videoUrl && <div className="absolute top-2 right-2 bg-pink-500 p-1 rounded-full"><Video className="w-3 h-3 text-white" /></div>}
                    </div>
                    <div className="mt-2 px-1 flex items-center justify-between"><p className="text-[9px] font-bold text-pink-400 uppercase">Saved</p><button onClick={e => { e.stopPropagation(); setSavedCreations(prev => prev.filter(item => item.id !== s.id)); }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="py-8 border-t dark:border-slate-800 bg-white dark:bg-slate-950 text-center text-xs text-slate-400">
        <p>Powered by Gemini 2.5 Flash Image & Veo 3.1. All data stored locally via IndexedDB.</p>
      </footer>
    </div>
  );
};

export default App;
