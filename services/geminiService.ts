
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { AIConfig } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

export const suggestPrompts = async (base64Image: string, mimeType: string): Promise<string[]> => {
  const ai = getAIClient();
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1],
              mimeType: mimeType,
            },
          },
          {
            text: "Analyze this product and suggest 3 creative, high-end commercial background descriptions for a product photo shoot. Return ONLY a JSON array of 3 strings."
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return ["Premium studio setting", "Nature background with soft lighting", "Minimalist marble surface"];
  }
};

export const generateSingleProductScene = async (
  base64Image: string,
  mimeType: string,
  backgroundPrompt: string,
  variationId: number,
  aiConfig: AIConfig
): Promise<string> => {
  const ai = getAIClient();
  
  const prompt = `Task: Professional Product Background Replacement.
    1. Identify the primary product or object in the image.
    2. Extract and isolate this object perfectly, maintaining its original colors, textures, and details.
    3. Generate a new background described as: "${backgroundPrompt}". (Unique Variation ID: ${variationId}-${Date.now()})
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
      temperature: aiConfig.temperature,
      topK: aiConfig.topK,
      topP: aiConfig.topP,
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
  count: number = 3,
  aiConfig: AIConfig
): Promise<string[]> => {
  const tasks = Array.from({ length: count }, (_, i) => 
    generateSingleProductScene(base64Image, mimeType, backgroundPrompt, i, aiConfig)
  );
  
  return Promise.all(tasks);
};
