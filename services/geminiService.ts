import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const getWaveFlavorText = async (wave: number): Promise<string> => {
  if (!ai) return `Wave ${wave} Incoming...`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are the narrator of a retro pixel-art tower defense game. 
      Write a very short, menacing, one-sentence warning for Wave ${wave}. 
      If it is a multiple of 5, it is a BOSS wave, make it epic. 
      Max 15 words. Do not use quotes.`,
    });
    return response.text || `Wave ${wave} Approachs!`;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `Wave ${wave} starts now!`;
  }
};
