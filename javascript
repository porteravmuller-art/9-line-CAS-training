
// server.js - Express backend for CAS 9-Line Trainer
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error("Set OPENAI_API_KEY in environment");
  process.exit(1);
}

// Pilot personality system prompts
const PILOT_SYSTEM_PROMPTS = {
  "A-10": `You are SPOOKY (A-10 pilot). Respond in short, gruff CAS radio style. Prepend replies with 'SPOOKY:'. Example: "SPOOKY: Copy, send 9-line."`,
  "C-130": `You are SPOOKY/AC-130 crew (C-130 gunship). Respond as a crew with 'Spooky' radio style. Prepend 'SPOOKY:'. Keep replies short.`,
  "F-16": `You are Viper (F-16 pilot). Quick, clipped replies. Prepend 'VIPER:'.`,
  "F-35": `You are Lightning (F-35 pilot). Precise, clipped replies. Prepend 'LIGHTNING:'.`,
  "F/A-18": `You are Hornet (F/A-18). Robust carrier tone, short replies. Prepend 'HORNET:'.`
};

// === Fallback Chat endpoint ===
app.post("/api/pilot", async (req, res) => {
  try {
    const { user_message, pilot="F-16", callsign="Scooter 1-6" } = req.body;
    if (!user_message) return res.status(400).send("Missing user_message");
    const system = PILOT_SYSTEM_PROMPTS[pilot] || PILOT_SYSTEM_PROMPTS["F-16"];
    // Build messages
    const messages = [
      { role: "system", content: system },
      { role: "user", content: `${callsign}: ${user_message}` }
    ];
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type":"application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.2,
        max_tokens: 120
      })
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("OpenAI error", t);
      return res.status(500).send("OpenAI error: " + t);
    }
    const j = await r.json();
    const reply = j.choices?.[0]?.message?.content?.trim() ?? "Unable to respond.";
    return res.json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error: " + err.message);
  }
});

// === Realtime session endpoint (basic) ===
// NOTE: This requires Realtime access on your OpenAI account and may have different URL/requirements in your account.
// This endpoint creates a short immediate reply and returns it to the client. For full WebRTC streaming you'd exchange offers/answers.
app.post("/api/realtime/session", async (req, res) => {
  try {
    const { user_message, pilot="F-16", callsign="Scooter 1-6" } = req.body;
    const system = PILOT_SYSTEM_PROMPTS[pilot] || PILOT_SYSTEM_PROMPTS["F-16"];
    // For simplicity, we make a quick chat completion to get an immediate short reply
    const messages = [
      { role: "system", content: system },
      { role: "user", content: `${callsign}: ${user_message}` }
    ];
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type":"application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.15,
        max_tokens: 100
      })
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("OpenAI realtime fallback error", t);
      return res.status(500).send("OpenAI error: " + t);
    }
    const j = await r.json();
    const reply = j.choices?.[0]?.message?.content?.trim() ?? "No reply.";
    // Return reply. Optionally you'd return WebRTC signaling info here for real streaming.
    return res.json({ reply, info: "Realtime quick-reply (no streaming). To enable streamed audio, extend this endpoint to handle WebRTC signaling to the OpenAI Realtime API." });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error: " + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`CAS pilot proxy listening on ${PORT}`));
