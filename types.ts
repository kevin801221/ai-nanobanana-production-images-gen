
export interface GenerationHistory {
  id: string;
  originalImage: string;
  resultImages: string[];
  selectedImageIndex: number;
  prompt: string;
  timestamp: number;
  videoUrl?: string; // New: Store generated video blob URL
}

export interface SavedCreation {
  id: string;
  image: string;
  originalImage: string;
  prompt: string;
  timestamp: number;
  videoUrl?: string; // New: Store saved video blob URL
}

export interface AIConfig {
  temperature: number;
  topK: number;
  topP: number;
}

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface BrandKit {
  isEnabled: boolean;
  logoImage: string | null; // Base64
  colors: string[];
  brandVoice: string; // e.g. "Minimalist", "Playful"
  fontStyle: string; // e.g. "Modern Sans"
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  SUGGESTING = 'SUGGESTING',
  REFINING = 'REFINING',
  GENERATING_VIDEO = 'GENERATING_VIDEO',
  ERASING = 'ERASING'
}
