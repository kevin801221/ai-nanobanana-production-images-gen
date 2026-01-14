
export interface GenerationHistory {
  id: string;
  originalImage: string;
  resultImages: string[];
  selectedImageIndex: number;
  prompt: string;
  timestamp: number;
}

export interface SavedCreation {
  id: string;
  image: string;
  originalImage: string;
  prompt: string;
  timestamp: number;
}

export interface AIConfig {
  temperature: number;
  topK: number;
  topP: number;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
