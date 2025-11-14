import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import ytSearch from "yt-search"; // A solução mágica para busca

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ==========================================================
// CONFIGURAÇÃO: INSTÂNCIAS PIPED (Para Extração de Áudio)
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

// User-Agents para evitar bloqueios 403
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
];

function getRandomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ==========================================================
// 1. BUSCA DE ID (ROBUSTA COM YT-SEARCH)
// ==========================================================
async function searchVideoId(query) {
  console.log(`🔎 [Server] Buscando ID para: "${query}"`);

  // MÉTODO 1: yt-search (Scraping direto - Mais confiável)
  try {
    // O yt-search busca direto no YouTube sem API Key, simulando usuário real
    const result = await ytSearch(query);
    
    if (result && result.videos && result.videos.length > 0) {
      const bestMatch = result.videos[0];
      console.log(`✅ ID encontrado (yt-search): ${bestMatch.videoId} | ${bestMatch.title}`);
      return bestMatch.videoId;
    }
  } catch (err) {
    console.log("⚠️ Erro no yt-search, tentando fallback...", err.message);
  }

  // MÉTODO 2: Fallback via Piped API (Caso o yt-search falhe)
  for (const base of PIPED_LIST) {
    try {
      const url = `${base}/search?q=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const r = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": getRandomAgent() }
      });
      clearTimeout(timeout);

      if (!r.ok) continue;

      const json = await r.json();
      
      if (json.items && json.items.length > 0) {
        const item = json.items.find(i => i.url && i.url.includes("/watch?v="));
        if (item) {
            const id = item.url.split("watch?v=")[1];
            console.log(`✅ ID encontrado (Piped Backup): ${id}`);
            return id;
        }
      }
    } catch (e) { /* ignora erros no loop */ }
  }
  
  return null;
}

// ==========================================================
// 2. EXTRAÇÃO DE ÁUDIO (PIPED)
// ==========================================================
async function getAudioFromPiped(videoId) {
  console.log(`🎵 [Server] Extraindo stream para ID: ${videoId}`);
  
  for (const base of PIPED_LIST) {
    const url = `${base}/streams/${videoId}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000); // 6s max por tentativa

      const r = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": getRandomAgent() },
      });
      clearTimeout(timeout);

      if (!r.ok) continue;

      const json = await r.json();
      if (!json?.audioStreams?.length) continue;

      // Lógica de Qualidade: Prefere m4a (AAC) e maior bitrate
      const sorted = json.audioStreams.sort((a, b) => {
        if (a.format === 'm4a' && b.format !== 'm4a') return -1; // m4a vence
        if (a.format !== 'm4a' && b.format === 'm4a') return 1;
        return (b.bitrate || 0) - (a.bitrate || 0); // maior bitrate vence
      });

      const best = sorted[0];

      if (best?.url) {
        console.log(`🎯 Sucesso em ${base} (${best.format} / ${Math.round(best.bitrate/1000)}k)`);
        return best.url;
      }
    } catch (e) { /* ignora */ }
  }
  return null;
}

// ==========================================================
// ROTAS DA API
// ==========================================================
app.get("/", (req, res) => {
  res.json({ status: "Vibra API Online", version: "1.1.0" });
});

app.post("/audio", async (req, res) => {
  let { videoId, query } = req.body;

  // 1. Se veio o nome da música (query), buscamos o ID
  if (!videoId && query) {
    videoId = await searchVideoId(query);
  }

  if (!videoId) {
    console.log("❌ Erro: Nenhum vídeo encontrado.");
    return res.status(404).json({ 
      success: false, 
      error: "Música não encontrada nas fontes de busca." 
    });
  }

  // 2. Tendo o ID, pegamos o link de áudio
  const finalAudio = await getAudioFromPiped(videoId);

  if (!finalAudio) {
    console.log("❌ Erro: ID existe mas instâncias falharam em dar áudio.");
    return res.status(500).json({
      success: false,
      error: "Servidores de áudio ocupados. Tente novamente em instantes.",
    });
  }

  // Sucesso!
  res.json({
    success: true,
    videoId: videoId,
    url: finalAudio,
  });
});

// START
app.listen(PORT, () => console.log(`🚀 Vibra Server rodando na porta ${PORT}`));
