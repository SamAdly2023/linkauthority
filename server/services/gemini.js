const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenAI } = require("@google/genai");
const keys = require('../config/keys');

// Initialize Gemini
// Note: Ensure GEMINI_API_KEY is in your .env file
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
let ai;

if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey: apiKey });
  } catch (err) {
    console.error("Failed to initialize Gemini:", err);
  }
}

const analyzeWebsite = async (url) => {
  // Default fallback object
  const defaultData = {
    category: 'General',
    serviceType: 'worldwide',
    location: {}
  };

  if (!ai) {
    console.log("Gemini API key missing. Returning default data.");
    return defaultData;
  }

  let websiteContent = "";
  try {
    // Fetch website content
    const response = await axios.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
      },
      timeout: 10000 // 10s timeout
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract relevant text for analysis
    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const h1 = $('h1').map((i, el) => $(el).text().trim()).get().join(' ');
    // Get first 2000 chars of body text to avoid token limits
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 2000);
    
    websiteContent = `
      URL: ${url}
      Title: ${title}
      Description: ${description}
      Main Heading: ${h1}
      Content Snippet: ${bodyText}
    `;
  } catch (fetchError) {
    console.warn(`Could not fetch content for ${url}. Relying on URL analysis only. Error: ${fetchError.message}`);
    websiteContent = `URL: ${url} (Site content could not be fetched)`;
  }

  const prompt = `
    Analyze the following website data:
    ${websiteContent}

    Determine the following:
    1. The business niche/category (e.g., Technology, Health, E-commerce, Real Estate, Law, Plumbing, Marketing, etc.). Be specific.
    2. The service scope: is it "local" (serving a specific city/region/country) or "worldwide" (digital products, blogs, global shipping, software)?
    3. If "local", identify the Country, State, and City. Even if it's a country-specific service (e.g. UK only), treat it as local and provide the Country.

    Return ONLY a JSON object with this structure:
    {
      "category": "string",
      "serviceType": "local" | "worldwide",
      "location": {
        "country": "string (or null)",
        "state": "string (or null)",
        "city": "string (or null)"
      }
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text();
    // Clean up potential markdown code blocks if the model adds them despite mimeType
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (parseError) {
        console.error("Failed to parse Gemini JSON response:", text);
        return defaultData;
    }
    
    return {
      category: data.category || 'General',
      serviceType: data.serviceType || 'worldwide',
      location: data.location || {}
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return defaultData;
  }
};

const getSEOAdvice = async (siteUrl, da) => {
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
    "keywordOpportunities": [
        { "keyword": "keyword phrase", "difficulty": "Easy"|"Medium"|"Hard", "volume": "e.g. 1.2k", "intent": "Informational"|"Commercial"|"Transactional" }
    ],
    "monthlyGrowth": [
      { "month": "Month 1", "traffic": number, "backlinks": number },
      { "month": "Month 2", "traffic": number, "backlinks": number },
      { "month": "Month 3", "traffic": number, "backlinks": number },
      { "month": "Month 4", "traffic": number, "backlinks": number },
      { "month": "Month 5", "traffic": number, "backlinks": number },
      { "month": "Month 6", "traffic": number, "backlinks": number }
    ]
  }
  
  Requirements:
  1. "technicalSeo" must include at least 12-15 distinct technical checks.
  2. "keywordOpportunities" must include 5-8 high-potential keywords relevant to the site's niche.
  3. "summary" should be dense and informative, providing deep technical insights.
  4. Ensure the data is realistic for a site with DA ${da}.
  5. Do not include markdown formatting like \`\`\`json. Just return the raw JSON string.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(jsonStr);
    data.screenshotUrl = `https://image.thum.io/get/width/1200/crop/800/noanimate/${siteUrl}`;
    
    return data;
  } catch (error) {
    console.error("Gemini SEO Advice Error:", error);
    return null;
  }
};

module.exports = { analyzeWebsite, getSEOAdvice };

