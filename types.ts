
export interface GenerationHistory {
  id: string;
  originalImage: string;
  resultImages: string[];
  selectedImageIndex: number;
  prompt: string;
  timestamp: number;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
