import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ==========================================================
// LISTA DE INSTÂNCIAS (BACKEND POOL)
// ==========================================================
const PIPED_LIST = [
  "https://pipedapi.drgns.space",
  "https://pipedapi.tokhmi.xyz",
  "https://pipedapi.kavin.rocks",
  "https://pa.il.ax",
  "https://pipedapi.smnz.de",
  "https://piped-api.lunar.icu",
  "https://pipedapi.adminforge.de"
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
];

function getRandomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ==========================================================
// 1. FUNÇÃO: BUSCAR ID DO VÍDEO
// ==========================================================
async function searchVideoId(query) {
  console.log(`🔎 [Server] Buscando ID para: "${query}"`);
  
  for (const base of PIPED_LIST) {
    try {
      // Busca focada em músicas
      const url = `${base}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout busca

      const r = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": getRandomAgent() }
      });
      clearTimeout(timeout);

      if (!r.ok) continue;

      const json = await r.json();
      
      // Tenta achar o primeiro item que seja um vídeo
      if (json.items && json.items.length > 0) {
        const item = json.items.find(i => i.url && i.url.includes("/watch?v="));
        if (item) {
            const id = item.url.split("watch?v=")[1];
            console.log(`✅ ID encontrado em ${base}: ${id}`);
            return id;
        }
      }
    } catch (e) {
      // Falha silenciosa, tenta próxima instância
    }
  }
  console.log("❌ Falha na busca do ID em todas as instâncias.");
  return null;
}

// ==========================================================
// 2. FUNÇÃO: PEGAR STREAM DE ÁUDIO
// ==========================================================
async function getAudioFromPiped(videoId) {
  console.log(`🎵 [Server] Extraindo áudio para ID: ${videoId}`);
  
  for (const base of PIPED_LIST) {
    const url = `${base}/streams/${videoId}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const r = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": getRandomAgent() },
      });
      clearTimeout(timeout);

      if (!r.ok) continue;

      const json = await r.json();
      if (!json?.audioStreams?.length) continue;

      // Ordena: m4a primeiro, depois bitrate
      const sorted = json.audioStreams.sort((a, b) => {
        if (a.format === 'm4a' && b.format !== 'm4a') return -1;
        if (a.format !== 'm4a' && b.format === 'm4a') return 1;
        return (b.bitrate || 0) - (a.bitrate || 0);
      });

      if (sorted[0]?.url) {
        console.log(`🎯 Áudio extraído com sucesso de: ${base}`);
        return sorted[0].url;
      }
    } catch (e) {}
  }
  return null;
}

// ==========================================================
// ROTA PRINCIPAL
// ==========================================================
app.post("/audio", async (req, res) => {
  let { videoId, query } = req.body;

  // 1. Se não veio videoId, tenta buscar pelo nome (query)
  if (!videoId && query) {
    videoId = await searchVideoId(query);
  }

  if (!videoId) {
    return res.status(404).json({ 
      success: false, 
      error: "Não foi possível encontrar um vídeo para essa busca." 
    });
  }

  // 2. Com o videoId em mãos, busca o áudio
  const finalAudio = await getAudioFromPiped(videoId);

  if (!finalAudio) {
    return res.status(500).json({
      success: false,
      error: "Falha ao extrair link de áudio das instâncias Piped.",
    });
  }

  res.json({
    success: true,
    videoId: videoId, // Retorna o ID para o front cachear se quiser
    url: finalAudio,
  });
});

app.get("/", (req, res) => res.send("Vibra API V2 (Server-Side Search) OK"));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
