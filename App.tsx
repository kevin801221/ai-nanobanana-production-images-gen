
import React, { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, Sparkles, History, Download, RefreshCw, X, ArrowRight, Camera, Circle } from 'lucide-react';
import { generateProductScene } from './services/geminiService';
import { GenerationHistory, GenerationStatus } from './types';

const App: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [backgroundPrompt, setBackgroundPrompt] = useState<string>('');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
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
        setSelectedImage(reader.result as string);
        setResultImage(null);
        setStatus(GenerationStatus.IDLE);
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
        setSelectedImage(dataUrl);
        setMimeType('image/jpeg');
        setResultImage(null);
        setStatus(GenerationStatus.IDLE);
        stopCamera();
      }
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage || !backgroundPrompt) return;

    try {
      setStatus(GenerationStatus.GENERATING);
      setError(null);
      
      const result = await generateProductScene(selectedImage, mimeType, backgroundPrompt);
      
      setResultImage(result);
      setStatus(GenerationStatus.SUCCESS);

      // Add to history
      const newHistoryItem: GenerationHistory = {
        id: Date.now().toString(),
        originalImage: selectedImage,
        resultImage: result,
        prompt: backgroundPrompt,
        timestamp: Date.now(),
      };
      setHistory(prev => [newHistoryItem, ...prev]);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate image. Please try again.');
      setStatus(GenerationStatus.ERROR);
    }
  };

  const reset = () => {
    setSelectedImage(null);
    setResultImage(null);
    setBackgroundPrompt('');
    setStatus(GenerationStatus.IDLE);
    setError(null);
    stopCamera();
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
      {/* Header */}
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
          
          {/* Main Workspace */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Image Preview & Upload Area */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
              {!selectedImage && !isCameraActive ? (
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
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                    />
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
              ) : isCameraActive ? (
                <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
                    <button 
                      onClick={stopCamera}
                      className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white transition-all"
                    >
                      <X className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={capturePhoto}
                      className="p-1 bg-white rounded-full transition-transform active:scale-90"
                    >
                      <Circle className="w-14 h-14 text-white fill-white border-4 border-slate-900 rounded-full" />
                    </button>
                    <div className="w-12" /> {/* Spacer */}
                  </div>
                  
                  <div className="absolute top-4 left-4 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Live Camera
                  </div>
                </div>
              ) : (
                <div className="relative flex-1 bg-slate-100 flex items-center justify-center p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
                    <div className="relative group">
                      <img 
                        src={selectedImage!} 
                        className="w-full h-full object-contain rounded-lg bg-white shadow-inner" 
                        alt="Original" 
                      />
                      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                        Original
                      </div>
                      <button 
                        onClick={reset}
                        className="absolute top-2 right-2 p-1.5 bg-white shadow-md rounded-full text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="relative group min-h-[300px] flex items-center justify-center bg-slate-200/50 rounded-lg overflow-hidden border border-slate-300">
                      {status === GenerationStatus.GENERATING ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="relative">
                            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
                            <Sparkles className="absolute -top-2 -right-2 w-4 h-4 text-indigo-400 animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-slate-700">Reimagining your scene...</p>
                            <p className="text-xs text-slate-500 mt-1">This usually takes 5-10 seconds</p>
                          </div>
                        </div>
                      ) : resultImage ? (
                        <>
                          <img 
                            src={resultImage} 
                            className="w-full h-full object-contain bg-white shadow-inner" 
                            alt="Result" 
                          />
                          <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded shadow-lg">
                            New Scene
                          </div>
                          <button 
                            onClick={() => downloadImage(resultImage, 'product-scene.png')}
                            className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-slate-900 p-3 rounded-full shadow-lg transition-all hover:scale-105 group"
                            title="Download"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <div className="text-slate-400 text-center px-6">
                          <ImageIcon className="w-10 h-10 mx-auto opacity-20 mb-3" />
                          <p className="text-sm font-medium">Ready to generate</p>
                          <p className="text-xs mt-1">Choose a background style to see magic</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
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
                  <button
                    key={preset}
                    onClick={() => setBackgroundPrompt(`Placed on a ${preset.toLowerCase()} background with professional studio lighting`)}
                    className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-colors bg-slate-50"
                  >
                    + {preset}
                  </button>
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
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    Generate New Scene
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

          {/* Sidebar Info/Tips */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-indigo-900 rounded-2xl p-6 text-white relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-2">Pro Tips</h3>
                <ul className="space-y-4 text-indigo-100 text-sm">
                  <li className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                    <p>Use high-resolution photos of your product for better edge detection.</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                    <p>Describe lighting in your prompt like "soft sunrise" or "dramatic shadows".</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                    <p>Mention materials like "polished oak", "brushed metal", or "silk fabric".</p>
                  </li>
                </ul>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Camera className="w-4 h-4 text-slate-400" />
                How it works
              </h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Upload</h4>
                    <p className="text-xs text-slate-500">Share a photo of your physical product.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Prompt</h4>
                    <p className="text-xs text-slate-500">Type any background style you can imagine.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Export</h4>
                    <p className="text-xs text-slate-500">Download studio-quality marketing images.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* History Drawer Overlay */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-xl text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Creations
              </h2>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {history.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <ImageIcon className="w-12 h-12 mx-auto opacity-20 mb-4" />
                  <p>No creations yet.</p>
                  <p className="text-sm">Your generated scenes will appear here.</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="group bg-slate-50 rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-300 transition-all">
                    <div className="aspect-video relative overflow-hidden">
                      <img src={item.resultImage} className="w-full h-full object-cover" alt="Result" />
                      <button 
                        onClick={() => downloadImage(item.resultImage, `product-${item.id}.png`)}
                        className="absolute bottom-2 right-2 p-2 bg-white/90 hover:bg-white rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-4 h-4 text-slate-700" />
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-semibold text-slate-500 mb-1">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-sm text-slate-700 line-clamp-2 italic">"{item.prompt}"</p>
                      <button 
                        onClick={() => {
                          setSelectedImage(item.originalImage);
                          setBackgroundPrompt(item.prompt);
                          setResultImage(item.resultImage);
                          setShowHistory(false);
                        }}
                        className="mt-3 text-xs font-bold text-indigo-600 flex items-center gap-1 hover:gap-2 transition-all"
                      >
                        Reuse settings <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            Powered by <strong>Gemini 2.5 Flash Image</strong> for professional-grade product rendering.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
