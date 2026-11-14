import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generate() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: "Minimal modern mobile app UI card background, soft peach and orange gradient, rounded abstract shape in the top right corner, subtle glass effect, smooth shadows, clean fintech dashboard style, soft lighting, minimal design, pastel color palette, professional SaaS interface background",
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64Data = part.inlineData.data;
        fs.writeFileSync('public/shops-bg.png', Buffer.from(base64Data, 'base64'));
        console.log('Image saved successfully!');
        break;
      }
    }
  } catch (error) {
    console.error("Error generating image:", error);
  }
}

generate();
