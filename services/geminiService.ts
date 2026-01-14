
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { AIConfig } from "../types";

const getAIClient = () => {
  // Always create a new client to ensure latest API key is used (especially after Veo key selection)
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

export const refinePromptWithInstruction = async (currentPrompt: string, instruction: string): Promise<string> => {
  const ai = getAIClient();
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Current Scene Description: "${currentPrompt}"
    User Change Request: "${instruction}"
    
    Task: Rewrite the scene description to incorporate the user's change request while maintaining a professional product photography style. Keep the description concise and descriptive. Return ONLY the new description text.`,
  });

  return response.text?.trim() || currentPrompt;
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

export const generateProductVideo = async (image: string, prompt: string): Promise<string> => {
  const ai = getAIClient();
  
  // Use a simplified prompt for video that focuses on motion and atmosphere
  const videoPrompt = `Cinematic product video, ${prompt}, subtle professional camera motion, high quality, 4k`;

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: videoPrompt,
    image: {
      imageBytes: image.split(',')[1],
      mimeType: 'image/png', // Assuming output is PNG
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9' // Veo supports 16:9 or 9:16. Defaulting to 16:9 for cinematic look.
    }
  });

  // Poll for completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed to return a URI");

  // Fetch the video bytes
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!response.ok) throw new Error("Failed to download generated video");
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
