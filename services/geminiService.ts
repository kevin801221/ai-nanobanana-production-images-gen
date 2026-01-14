
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

export const generateSingleProductScene = async (
  base64Image: string,
  mimeType: string,
  backgroundPrompt: string,
  variationId: number
): Promise<string> => {
  const ai = getAIClient();
  
  // Adding a slight variation to the prompt to encourage diversity in seeds/results
  const prompt = `Task: Professional Product Background Replacement.
    1. Identify the primary product or object in the image.
    2. Extract and isolate this object perfectly, maintaining its original colors, textures, and details.
    3. Generate a new background described as: "${backgroundPrompt}". (Variation index: ${variationId})
    4. Seamlessly integrate the original object into this new scene.
    5. Ensure realistic lighting, matching shadows, and perspective.
    6. The result must be a high-quality, professional studio product photograph.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image.split(',')[1],
            mimeType: mimeType,
          },
        },
        {
          text: prompt
        }
      ]
    },
    config: {
      temperature: 1.0, // Higher temperature for more variation
    }
  });

  if (!response.candidates || response.candidates.length === 0) {
    throw new Error("No candidates returned from AI");
  }

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image data found in response");
};

export const generateProductSceneVariations = async (
  base64Image: string,
  mimeType: string,
  backgroundPrompt: string,
  count: number = 3
): Promise<string[]> => {
  const tasks = Array.from({ length: count }, (_, i) => 
    generateSingleProductScene(base64Image, mimeType, backgroundPrompt, i)
  );
  
  return Promise.all(tasks);
};
