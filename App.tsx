
import React, { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, Sparkles, History, Download, RefreshCw, X, ArrowRight, Camera, Circle, Crop, Check, Layers } from 'lucide-react';
import Cropper, { Area } from 'react-easy-crop';
import { generateProductSceneVariations } from './services/geminiService';
import { GenerationHistory, GenerationStatus } from './types';

const App: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [backgroundPrompt, setBackgroundPrompt] = useState<string>('');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  
  // Multiple results state
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [variationCount, setVariationCount] = useState<number>(3);

  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Cropping states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMimeType(file.type);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImage(reader.result as string);
        setIsCropping(true);
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setTempImage(dataUrl);
        setMimeType('image/jpeg');
        setIsCropping(true);
        stopCamera();
      }
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const handleCropSave = async () => {
    if (!tempImage || !croppedAreaPixels) return;
    try {
      const image = await createImage(tempImage);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
      const croppedDataUrl = canvas.toDataURL(mimeType || 'image/jpeg');
      setSelectedImage(croppedDataUrl);
      setResultImages([]);
      setIsCropping(false);
      setTempImage(null);
      setStatus(GenerationStatus.IDLE);
    } catch (e) {
      console.error(e);
      setError("Failed to crop image.");
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage || !backgroundPrompt) return;
    try {
      setStatus(GenerationStatus.GENERATING);
      setError(null);
      
      const results = await generateProductSceneVariations(selectedImage, mimeType, backgroundPrompt, variationCount);
      
      setResultImages(results);
      setSelectedResultIndex(0);
      setStatus(GenerationStatus.SUCCESS);

      const newHistoryItem: GenerationHistory = {
        id: Date.now().toString(),
        originalImage: selectedImage,
        resultImages: results,
        selectedImageIndex: 0,
        prompt: backgroundPrompt,
        timestamp: Date.now(),
      };
      setHistory(prev => [newHistoryItem, ...prev]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate images. Please try again.');
      setStatus(GenerationStatus.ERROR);
    }
  };

  const reset = () => {
    setSelectedImage(null);
    setTempImage(null);
    setResultImages([]);
    setBackgroundPrompt('');
    setStatus(GenerationStatus.IDLE);
    setError(null);
    stopCamera();
    setIsCropping(false);
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl text-slate-900 tracking-tight">ProductScene AI</h1>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <History className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">History</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
              {!selectedImage && !isCameraActive && !isCropping ? (
                <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors group p-8 text-center"
                  >
                    <div className="bg-indigo-50 p-4 rounded-full group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8 text-indigo-600" />
                    </div>
                    <p className="mt-4 font-semibold text-slate-900">Upload product photo</p>
                    <p className="text-slate-500 text-sm mt-1">PNG, JPG or WebP up to 10MB</p>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>
                  <div 
                    onClick={startCamera}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors group p-8 text-center"
                  >
                    <div className="bg-emerald-50 p-4 rounded-full group-hover:scale-110 transition-transform">
                      <Camera className="w-8 h-8 text-emerald-600" />
                    </div>
                    <p className="mt-4 font-semibold text-slate-900">Take a photo</p>
                    <p className="text-slate-500 text-sm mt-1">Use your device's camera</p>
                  </div>
                </div>
              ) : isCropping && tempImage ? (
                <div className="relative flex-1 bg-slate-900 flex flex-col min-h-[500px]">
                  <div className="relative flex-1">
                    <Cropper image={tempImage} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
                  </div>
                  <div className="bg-white p-4 flex flex-col gap-4 border-t border-slate-200">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {[1, 4/3, 16/9, undefined].map((val) => (
                        <button key={String(val)} onClick={() => setAspect(val)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${aspect === val ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                          {val === 1 ? '1:1' : val === 4/3 ? '4:3' : val === 16/9 ? '16:9' : 'Free'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <button onClick={() => { setIsCropping(false); setTempImage(null); }} className="px-6 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-50 flex items-center gap-2"><X className="w-4 h-4" /> Cancel</button>
                      <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      <button onClick={handleCropSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 hover:bg-indigo-700 transition-all"><Check className="w-4 h-4" /> Confirm Crop</button>
                    </div>
                  </div>
                </div>
              ) : isCameraActive ? (
                <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
                    <button onClick={stopCamera} className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white"><X className="w-6 h-6" /></button>
                    <button onClick={capturePhoto} className="p-1 bg-white rounded-full transition-transform active:scale-90"><Circle className="w-14 h-14 text-white fill-white border-4 border-slate-900 rounded-full" /></button>
                    <div className="w-12" />
                  </div>
                </div>
              ) : (
                <div className="relative flex-1 bg-slate-100 flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
                  <div className="flex-1 relative group bg-white rounded-lg shadow-inner overflow-hidden flex items-center justify-center">
                    <img src={selectedImage!} className="max-w-full max-h-full object-contain" alt="Original" />
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">Cropped Source</div>
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setTempImage(selectedImage); setIsCropping(true); }} className="p-1.5 bg-white shadow-md rounded-full text-slate-600 hover:text-indigo-600"><Crop className="w-4 h-4" /></button>
                      <button onClick={reset} className="p-1.5 bg-white shadow-md rounded-full text-slate-600 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="flex-1 relative group min-h-[350px] flex flex-col items-center justify-center bg-slate-200/50 rounded-lg overflow-hidden border border-slate-300">
                    {status === GenerationStatus.GENERATING ? (
                      <div className="flex flex-col items-center gap-4 p-8">
                        <div className="relative">
                          <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
                          <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-indigo-400 animate-pulse" />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-700">Generating {variationCount} variations...</p>
                          <p className="text-xs text-slate-500 mt-1">Crafting studio-quality backgrounds</p>
                        </div>
                      </div>
                    ) : resultImages.length > 0 ? (
                      <div className="w-full h-full flex flex-col">
                        <div className="flex-1 relative bg-white flex items-center justify-center p-2">
                          <img src={resultImages[selectedResultIndex]} className="max-w-full max-h-full object-contain" alt={`Result ${selectedResultIndex}`} />
                          <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded shadow-lg">Variation {selectedResultIndex + 1}</div>
                          <button onClick={() => downloadImage(resultImages[selectedResultIndex], `product-scene-${selectedResultIndex + 1}.png`)} className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-slate-900 p-3 rounded-full shadow-lg transition-all hover:scale-105 group"><Download className="w-5 h-5" /></button>
                        </div>
                        <div className="h-20 bg-slate-800/90 flex items-center gap-2 px-3 overflow-x-auto scrollbar-hide">
                          {resultImages.map((img, idx) => (
                            <button 
                              key={idx} 
                              onClick={() => setSelectedResultIndex(idx)}
                              className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-all ${selectedResultIndex === idx ? 'border-indigo-400 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            >
                              <img src={img} className="w-full h-full object-cover" alt={`Thumb ${idx}`} />
                            </button>
                          ))}
                          <button 
                            onClick={handleGenerate}
                            className="flex-shrink-0 w-14 h-14 rounded-md bg-white/10 flex flex-col items-center justify-center text-white/60 hover:bg-white/20 transition-colors"
                            title="Regenerate all"
                          >
                            <RefreshCw className="w-5 h-5" />
                            <span className="text-[8px] mt-1 font-bold">REGEN</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-center px-6">
                        <ImageIcon className="w-10 h-10 mx-auto opacity-20 mb-3" />
                        <p className="text-sm font-medium">No Scene Generated</p>
                        <p className="text-xs mt-1">Apply your style below to see variations</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Number of Variations
                </label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {[3, 4, 5].map((num) => (
                    <button 
                      key={num} 
                      onClick={() => setVariationCount(num)}
                      className={`px-4 py-1 rounded-md text-xs font-bold transition-all ${variationCount === num ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Background Description
                </label>
                <textarea 
                  value={backgroundPrompt}
                  onChange={(e) => setBackgroundPrompt(e.target.value)}
                  placeholder="e.g., 'on a sleek marble countertop with soft warm morning light hitting from the side'"
                  className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none text-slate-700"
                  disabled={status === GenerationStatus.GENERATING}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {['Luxury Marble', 'Wooden Desk', 'Zen Garden', 'Neon Cyberpunk', 'Minimalist Studio'].map((preset) => (
                  <button key={preset} onClick={() => setBackgroundPrompt(`Placed on a ${preset.toLowerCase()} background with professional studio lighting`)} className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-colors bg-slate-50">+ {preset}</button>
                ))}
              </div>

              <button
                disabled={!selectedImage || !backgroundPrompt || status === GenerationStatus.GENERATING}
                onClick={handleGenerate}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
              >
                {status === GenerationStatus.GENERATING ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Generating {variationCount} Scenes...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    Generate Variations
                  </>
                )}
              </button>
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-indigo-900 rounded-2xl p-6 text-white relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-2">Pro Tips</h3>
                <ul className="space-y-4 text-indigo-100 text-sm">
                  <li className="flex gap-3"><div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">1</div><p>Generate multiple variations to find the perfect lighting balance.</p></li>
                  <li className="flex gap-3"><div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">2</div><p>Cropping tightly around the product helps the AI focus on extraction.</p></li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-slate-400" />Variation Feature</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                By generating 3-5 variations, you can compare different AI interpretations of your scene description. Each variation uses a unique seed to provide diverse artistic results.
              </p>
            </div>
          </div>
        </div>
      </main>

      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-xl text-slate-900 flex items-center gap-2"><History className="w-5 h-5" />History</h2>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {history.length === 0 ? (
                <div className="text-center py-20 text-slate-400"><ImageIcon className="w-12 h-12 mx-auto opacity-20 mb-4" /><p>No creations yet.</p></div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="group bg-slate-50 rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-300 transition-all">
                    <div className="aspect-video relative overflow-hidden bg-white">
                      <img src={item.resultImages[item.selectedImageIndex]} className="w-full h-full object-contain" alt="History Result" />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <span className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">{item.resultImages.length} variations</span>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{new Date(item.timestamp).toLocaleDateString()}</p>
                      <p className="text-sm text-slate-700 line-clamp-2 italic">"{item.prompt}"</p>
                      <button 
                        onClick={() => {
                          setSelectedImage(item.originalImage);
                          setBackgroundPrompt(item.prompt);
                          setResultImages(item.resultImages);
                          setSelectedResultIndex(item.selectedImageIndex);
                          setShowHistory(false);
                        }}
                        className="mt-3 text-xs font-bold text-indigo-600 flex items-center gap-1 hover:gap-2 transition-all"
                      >
                        Load variations <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="py-6 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">Powered by <strong>Gemini 2.5 Flash Image</strong> Variations API.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
