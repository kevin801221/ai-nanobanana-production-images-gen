
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { AIConfig, BrandKit } from "../types";

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
  aiConfig: AIConfig,
  brandKit?: BrandKit
): Promise<string> => {
  const ai = getAIClient();
  
  let brandInstruction = "";
  if (brandKit && brandKit.isEnabled) {
    const colors = brandKit.colors.join(', ');
    brandInstruction = `
    STRICT BRAND GUIDELINES:
    - Use the following color palette for the background/props: ${colors}.
    - The brand style/mood is: ${brandKit.brandVoice}.
    - Ensure the scene strictly adheres to this aesthetic.
    `;
  }

  const prompt = `Task: Professional Product Background Replacement.
    1. Identify the primary product or object in the image.
    2. Extract and isolate this object perfectly, maintaining its original colors, textures, and details.
    3. Generate a new background described as: "${backgroundPrompt}".
    ${brandInstruction}
    (Unique Variation ID: ${variationId}-${Date.now()})
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
  aiConfig: AIConfig,
  brandKit?: BrandKit
): Promise<string[]> => {
  const tasks = Array.from({ length: count }, (_, i) => 
    generateSingleProductScene(base64Image, mimeType, backgroundPrompt, i, aiConfig, brandKit)
  );
  
  return Promise.all(tasks);
};

export const eraseObjectFromImage = async (
  image: string,
  maskImage: string
): Promise<string> => {
  const ai = getAIClient();
  
  const prompt = `The second image provided is a mask where white pixels indicate the area to be removed (erased). 
  Task: Modify the first image by removing the objects or artifacts covered by the white mask area. 
  Fill in the erased area seamlessly to match the surrounding background texture, lighting, and context. 
  Ensure the result looks natural and high quality.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: image.split(',')[1],
            mimeType: 'image/png', 
          },
        },
        {
          inlineData: {
            data: maskImage.split(',')[1],
            mimeType: 'image/png',
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

export const generateProductVideo = async (image: string, prompt: string, brandKit?: BrandKit): Promise<string> => {
  const ai = getAIClient();
  
  let brandInstruction = "";
  if (brandKit && brandKit.isEnabled) {
      const colors = brandKit.colors.join(', ');
      brandInstruction = `in the style of ${brandKit.brandVoice}, utilizing brand colors ${colors} where possible,`;
  }

  const videoPrompt = `Cinematic product video, ${prompt}, ${brandInstruction} subtle professional camera motion, high quality, 4k`;

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: videoPrompt,
    image: {
      imageBytes: image.split(',')[1],
      mimeType: 'image/png', 
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed to return a URI");

  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!response.ok) throw new Error("Failed to download generated video");
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
