const axios = require('axios');

const estimateAuthority = async (url) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is missing. Returning random DA.");
    return Math.floor(Math.random() * 50) + 10;
  }

  const prompt = `Analyze the website "${url}". Based on its likely reputation, niche, and public presence, estimate a Domain Authority (DA) score between 1 and 100. 
  Return ONLY a single integer number. Do not include any text, explanation, or markdown. 
  If the site is unknown or new, return a low score like 10.`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    const score = parseInt(text.trim());

    if (isNaN(score)) return 15; // Fallback
    return Math.min(Math.max(score, 1), 100); // Clamp between 1-100

  } catch (error) {
    console.error("AI Authority Estimation Failed:", error.message);
    return Math.floor(Math.random() * 20) + 5; // Fallback to low random score
  }
};

module.exports = { estimateAuthority };
