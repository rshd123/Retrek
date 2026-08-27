import express from "express";
import Groq from "groq-sdk";

const router = express.Router();
const groq = new Groq({ apiKey: process.env.LLM_API_KEY });

router.get("/llmTest", async (req, res) => {
  try {
    const response = await groq.chat.completions.create({
      model: process.env.MODEL_NAME || "qwen/qwen3.6-27b",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 100,
    });

    const reply = response.choices[0]?.message?.content;
    res.json({ success: true, message: reply });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
