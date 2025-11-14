import express from "express";
import cors from "cors";
import { Innertube, UniversalCache } from "youtubei.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

let yt = null;

// ==========================================================
// 1. INICIALIZAÇÃO DO MOTOR
// ==========================================================
async function startEngine() {
  try {
    console.log("⚙️  Iniciando Motor (Smart Search)...");

    yt = await Innertube.create({
      cache: new UniversalCache(),
      generate_session_locally: true,
      location: "BR",
      lang: "pt",
      device_category: "mobile",
      device_client: "ANDROID"
    });

    console.log("✅ Motor Pronto!");
  } catch (error) {
    console.error("❌ Erro fatal:", error);
  }
}

startEngine();

// ==========================================================
// 2. FUNÇÃO SMART SEARCH — CORRIGIDA
// ==========================================================
async function smartSearch(query, limit = 10) { // Adicionado 'limit'
  try {
    const search = await yt.search(query);

    if (!search?.results) return []; // Retorna array vazio

    const videos = search.results.filter(
      (i) =>
        i.id &&
        (i.type === "Video" || i.type === "CompactVideo") &&
        i.duration &&
        !i.is_live
    );
    
    // Retorna a lista limitada
    if (videos.length > 0) return videos.slice(0, limit);

    return []; // Retorna array vazio se não houver vídeos
  } catch (e) {
    console.log("Erro no Smart Search:", e.message);
    return [];
  }
}

// ==========================================================
// 🔥 ROTA /youtube/search — CORRIGIDA
// ==========================================================
app.post("/youtube/search", async (req, res) => {
  const { query, limit = 10 } = req.body; // Aceita 'limit'

  if (!yt) return res.status(503).json({ error: "Inicializando motor..." });
  if (!query) return res.status(400).json({ error: "Query ausente." });

  try {
    console.log(`🔎 Buscando YouTube: ${query} (limite: ${limit})`);

    const results = await smartSearch(query, limit); // Passa o 'limit'

    if (!results || results.length === 0)
      return res.status(404).json({ error: "Nenhum vídeo encontrado." });

    // Mapeia a LISTA de resultados
    const data = results.map((video) => ({
      videoId: video.id,
      title: video.title?.text || video.title,
      artist: video.author?.name || "",
      thumbnail:
        video.thumbnails?.[0]?.url ||
        video.best_thumbnail?.url ||
        null,
      duration_seconds: video.duration?.seconds || 0, // Envia segundos
    }));

    return res.json({
      success: true,
      results: data, // Retorna a lista como 'results'
    });
  } catch (err) {
    console.log("❌ Erro search:", err.message);
    res.status(500).json({ error: "Erro interno no search" });
  }
});


// ==========================================================
// 3. ROTA /audio (mantida)
// ==========================================================
app.post("/audio", async (req, res) => {
  if (!yt) return res.status(503).json({ error: "Inicializando..." });

  const { query, videoId } = req.body;
  let targetId = videoId;

  try {
    console.log(`📨 Recebido: "${query || videoId}"`);

    if (!targetId && query) {
      // Usa smartSearch mas pega só o primeiro (mais relevante)
      let results = await smartSearch(query, 1); 

      if (results.length === 0 && query.includes("audio")) {
        const clean = query.replace(/audio/gi, "").trim();
        console.log("⚠️ Tentando fallback:", clean);
        results = await smartSearch(clean, 1);
      }

      if (results.length === 0)
        return res.status(404).json({ error: "Vídeo não encontrado." });
      
      const result = results[0];
      targetId = result.id;
      console.log(`🔍 Encontrado: ${result.title?.text || result.title}`);
    }

    const info = await yt.getBasicInfo(targetId);

    const formats =
      info?.streaming_data?.adaptive_formats?.filter(
        (f) => f.has_audio && !f.has_video
      ) || [];

    if (!formats.length)
      return res
        .status(403)
        .json({ error: "Nenhum formato de áudio disponível" });

    formats.sort((a, b) => b.bitrate - a.bitrate);
    const bestAudio = formats[0];

    const url = await bestAudio.decipher(yt.session);

    console.log(
      `🚀 Stream OK: ${Math.round(bestAudio.bitrate / 1000)}kbps`
    );

    res.json({
      success: true,
      videoId: targetId,
      title: info.basic_info?.title || "Unknown",
      quality: `${Math.round(bestAudio.bitrate / 1000)}kbps`,
      url
    });
  } catch (e) {
    console.error("❌ Erro:", e.message);
    res.status(500).json({ error: "Erro interno." });
  }
});

app.listen(PORT, () =>
  console.log(`⚡ Servidor rodando na porta ${PORT}`)
);
