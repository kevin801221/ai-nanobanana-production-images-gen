
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

export const generateProductScene = async (
  base64Image: string,
  mimeType: string,
  backgroundPrompt: string
): Promise<string> => {
  const ai = getAIClient();
  
  // Refined prompt to ensure the product is kept intact while background changes
  const prompt = `Task: Background Replacement and Scene Integration.
    1. Identify the primary product or object in the provided image.
    2. Extract and isolate this object perfectly, maintaining its original colors, textures, and details.
    3. Generate a new background described as: "${backgroundPrompt}".
    4. Seamlessly place the original object into this new background, ensuring realistic lighting, shadows, and perspective integration.
    5. The final result should look like a professional studio product photograph.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image.split(',')[1], // Remove the data:image/png;base64, prefix
            mimeType: mimeType,
          },
        },
        {
          text: prompt
        }
      ]
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
