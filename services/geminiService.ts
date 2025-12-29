
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI;
try {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
} catch (error) {
  console.warn("Gemini AI initialization failed:", error);
}

export const getSEOAdvice = async (siteUrl: string, da: number) => {
  if (!ai) return "AI service unavailable.";
  
  const prompt = `Act as a senior SEO expert. The website "${siteUrl}" has a Domain Authority of ${da}. 
  Give 3 actionable tips to improve its link profile and suggest what kind of websites it should exchange links with for maximum growth. 
  Keep it concise and professional.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Could not generate AI advice at this moment.";
  }
};
