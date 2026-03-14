import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = "gemini-2.5-flash";
const TRAVEL_SYSTEM_INSTRUCTION = `
Anda adalah TravelGo, asisten perjalanan berbasis AI.

Aturan utama:
- Selalu jawab dalam bahasa Indonesia dengan gaya formal, sopan, jelas, dan profesional.
- Fokus hanya pada topik perjalanan: destinasi, itinerary, transportasi, akomodasi, estimasi anggaran, waktu terbaik berkunjung, perlengkapan, dan etika wisata.
- Berikan jawaban yang relevan, praktis, dan terstruktur agar mudah dipahami pengguna.
- Jika detail pengguna belum lengkap, ajukan pertanyaan klarifikasi yang singkat sebelum memberikan rekomendasi yang terlalu spesifik.
- Jika pengguna meminta itinerary atau rekomendasi, utamakan format terstruktur seperti ringkasan, saran utama, estimasi biaya, dan tips.
- Jangan mengklaim pemesanan real-time, harga real-time, atau ketersediaan real-time. Jika perlu, jelaskan bahwa estimasi dapat berubah.
- Hindari jawaban santai atau bercanda berlebihan. Pertahankan nada formal.
`;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = 3000;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/generate-text', async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt
    });

    res.status(200).json({ result: response.text });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: e.message });
  }
});

app.post("/generate-from-image", upload.single("image"), async (req, res) => {
  const { prompt } = req.body;
  const base64Image = req.file.buffer.toString("base64");

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { text: prompt, type: "text" },
        { inlineData: { data: base64Image, mimeType: req.file.mimetype } }
      ],
    });

    res.status(200).json({ result: response.text });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: e.message });
  }
});

app.post("/generate-from-document", upload.single("document"), async (req, res) => {
  const { prompt } = req.body;
  const base64Document = req.file.buffer.toString("base64");

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { text: prompt ?? "Tolong buat ringkasan dari dokumen berikut.", type: "text" },
        { inlineData: { data: base64Document, mimeType: req.file.mimetype } }
      ],
    });

    res.status(200).json({ result: response.text });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: e.message });
  }
});

app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
  const { prompt } = req.body;
  const base64Audio = req.file.buffer.toString("base64");

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { text: prompt ?? "Tolong buatkan transkrip dari rekaman berikut.", type: "text" },
        { inlineData: { data: base64Audio, mimeType: req.file.mimetype } }
      ],
    });

    res.status(200).json({ result: response.text });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: e.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { conversation } = req.body;
  try {
    if (!Array.isArray(conversation)) throw new Error('Messages must be an array!');
    if (conversation.length === 0) throw new Error('Conversation cannot be empty.');

    const contents = conversation.map(({ role, text }) => ({
      role: role === 'model' ? 'model' : 'user',
      parts: [{ text }]
    }));

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        temperature: 0.7,
        topP: 0.9,
        topK: 32,
        systemInstruction: TRAVEL_SYSTEM_INSTRUCTION,
      },
    });
    res.status(200).json({ result: response.text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
