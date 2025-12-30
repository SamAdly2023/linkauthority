
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
  Generate a highly detailed, dense, and professional SEO report in JSON format.
  
  Structure:
  {
    "seoScore": number (0-100),
    "performanceScore": number (0-100),
    "accessibilityScore": number (0-100),
    "bestPracticesScore": number (0-100),
    "summary": "A comprehensive, multi-paragraph executive summary of the site's current SEO standing, potential, and critical areas for improvement. Be specific and professional.",
    "technicalSeo": [
      { "title": "Specific Technical Check", "status": "pass"|"fail"|"warning", "description": "Detailed explanation of the finding and how to fix it." }
    ],
    "backlinkStrategy": {
      "focus": "Detailed strategic direction for link building.",
      "recommendedAnchors": ["anchor1", "anchor2", "anchor3", "anchor4", "anchor5"],
      "targetNiches": ["niche1", "niche2", "niche3", "niche4"]
    },
    "monthlyGrowth": [
      { "month": "Month 1", "traffic": number, "backlinks": number },
      ... (6 months projection)
    ]
  }
  
  Requirements:
  1. "technicalSeo" must include at least 8-10 distinct technical checks (e.g., SSL, Mobile Friendliness, Core Web Vitals, Schema Markup, Robots.txt, Sitemap, Canonical Tags, Broken Links).
  2. "summary" should be dense and informative, not just a single sentence.
  3. Ensure the data is realistic for a site with DA ${da}.
  4. Do not include markdown formatting like \`\`\`json. Just return the raw JSON string.`;

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
