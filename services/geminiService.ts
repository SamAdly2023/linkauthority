
import { GoogleGenAI } from "@google/genai";
import { AIReport } from "../types";

let ai: GoogleGenAI;
try {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
} catch (error) {
  console.warn("Gemini AI initialization failed:", error);
}

export const getSEOAdvice = async (siteUrl: string, da: number): Promise<AIReport | null> => {
  if (!ai) return null;
  
  const prompt = `Act as a senior SEO expert. Analyze the website "${siteUrl}" (DA: ${da}).
  Generate a detailed SEO report in JSON format with the following structure:
  {
    "seoScore": number (0-100),
    "performanceScore": number (0-100),
    "accessibilityScore": number (0-100),
    "bestPracticesScore": number (0-100),
    "summary": "Executive summary of the site's SEO status",
    "technicalSeo": [
      { "title": "Issue Title", "status": "pass"|"fail"|"warning", "description": "Details" }
    ],
    "backlinkStrategy": {
      "focus": "Main strategy focus",
      "recommendedAnchors": ["anchor1", "anchor2"],
      "targetNiches": ["niche1", "niche2"]
    },
    "monthlyGrowth": [
      { "month": "Jan", "traffic": number, "backlinks": number },
      { "month": "Feb", "traffic": number, "backlinks": number },
      { "month": "Mar", "traffic": number, "backlinks": number },
      { "month": "Apr", "traffic": number, "backlinks": number },
      { "month": "May", "traffic": number, "backlinks": number },
      { "month": "Jun", "traffic": number, "backlinks": number }
    ]
  }
  Ensure the data is realistic for a site with DA ${da}.
  Do not include markdown formatting like \`\`\`json. Just return the raw JSON string.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    
    let text = '';
    if (typeof response.text === 'function') {
        text = response.text();
    } else {
        text = (response as any).text;
    }

    if (!text) throw new Error("Empty response from AI");

    const data = JSON.parse(text);
    
    // Add screenshot URL
    data.screenshotUrl = `https://image.thum.io/get/width/1200/crop/800/noanimate/${siteUrl}`;
    
    return data;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};
