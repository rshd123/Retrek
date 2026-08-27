import express from "express";
import Groq from "groq-sdk";

const router = express.Router();

router.get("/llmTest", async (req, res) => {
  const startTime = Date.now();
  try {
    if (!process.env.LLM_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "LLM_API_KEY is not defined in backend/.env"
      });
    }

    const groq = new Groq({ apiKey: process.env.LLM_API_KEY });
    const model = process.env.MODEL_NAME || "qwen/qwen3.6-27b";

    const response = await groq.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Ping test. Respond with: Pong!" }],
      max_tokens: 50,
    });

    const reply = response.choices[0]?.message?.content;
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      provider: "Groq",
      model,
      latencyMs,
      message: reply
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      latencyMs: Date.now() - startTime,
      error: error.message
    });
  }
});

export default router;
