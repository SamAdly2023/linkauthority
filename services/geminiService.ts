
import { AIReport } from "../types";

export const getSEOAdvice = async (siteUrl: string, da: number): Promise<AIReport | null> => {
  try {
    const response = await fetch('/api/seo-advice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: siteUrl, da })
    });
    
    if (!response.ok) {
        console.error("API error:", response.statusText);
        return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};
