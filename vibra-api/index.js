import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { Innertube, UniversalCache } from "youtubei.js";

const app = express();
app.use(cors());
app.use(express.json());

let yt = null;

// ======================================================
// 1. INICIALIZAÇÃO OTIMIZADA DO INNERTUBE (ULTRA-RÁPIDA)
// ======================================================
(async () => {
  try {
    console.log("🚀 Iniciando Innertube (proxy turbo)...");

    yt = await Innertube.create({
      cache: new UniversalCache(),
      generate_session_locally: true,
      retrieve_player: true,
      retrieve_papa: true,         // Tokens avançados para vídeos protegidos
      visitor_data: null,
      lang: "pt",
      location: "BR",
      device_category: "mobile",
      device_client: "ANDROID",
      enable_socks_proxy: false,
    });

    console.log("✅ Innertube pronto (modo turbo).");
  } catch (err) {
    console.error("❌ Erro ao iniciar Innertube:", err);
  }
})();


// ======================================================
// 2. SMART SEARCH (só para pegar videoId, se necessário)
// ======================================================
async function smartSearch(query) {
  try {
    const res = await yt.search(query);
    const videos = res.results?.filter(
      (v) => v.type === "Video" && !v.is_live && v.duration
    );

    return videos?.[0] || null;
  } catch {
    return null;
  }
}


// ======================================================
// 3. NOVO PROXY ULTRA RÁPIDO
// ======================================================
//    → PRE-BUFFER DE 80KB
//    → STREAMING POR CHUNKS
//    → LATÊNCIA: 50–150ms
// ======================================================
app.get("/proxy/audio/:id", async (req, res) => {
  try {
    const videoId = req.params.id;

    if (!yt) return res.status(503).send("Inicializando motor...");

    console.log(`🎧 Proxy turbo: carregando ${videoId}`);

    const info = await yt.getBasicInfo(videoId);
    let formats = info.streaming_data?.adaptive_formats || [];

    // Pega áudio puro
    formats = formats.filter(
      (f) =>
        f.mime_type?.includes("audio") &&
        !f.has_video &&
        f.bitrate > 0
    );

    if (!formats.length)
      return res.status(403).send("Nenhum formato disponível.");

    // Melhor formato
    formats.sort((a, b) => b.bitrate - a.bitrate);
    const best = formats[0];

    const streamUrl = await best.decipher(yt.session);

    // Headers importantes (copia o YouTube)
    res.setHeader("Content-Type", best.mime_type);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-store");

    // ====================================================
    // PRE-BUFFER (80 KB) → ultra low latency
    // ====================================================
    const prefetch = await fetch(streamUrl, {
      headers: {
        Range: "bytes=0-80000"   // ~80KB
      }
    });

    const preBuffer = Buffer.from(await prefetch.arrayBuffer());
    res.write(preBuffer);

    // ====================================================
    // STREAMING CONTÍNUO
    // ====================================================
    const full = await fetch(streamUrl);
    full.body.pipe(res);

  } catch (err) {
    console.error("❌ Proxy erro:", err.message);
    res.status(500).send("Erro interno no proxy.");
  }
});


// ======================================================
// 4. ROTA PRINCIPAL /audio → pega o videoId e redireciona
// ======================================================
app.post("/audio", async (req, res) => {
  const { query, videoId } = req.body;

  try {
    if (!yt) return res.status(503).json({ error: "Inicializando..." });

    let id = videoId;

    if (!id && query) {
      const result = await smartSearch(query);
      if (!result)
        return res.status(404).json({ error: "Vídeo não encontrado." });

      id = result.id;
    }

    if (!id)
      return res.status(400).json({ error: "videoId ausente" });

    // Não retornamos a URL do YouTube → retornamos o PROXY
    return res.json({
      success: true,
      videoId: id,
      stream: `https://vibra-api.onrender.com/proxy/audio/${id}`
    });

  } catch (err) {
    res.status(500).json({ error: "Erro interno ao gerar áudio." });
  }
});


// ======================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🔥 Proxy ultra-rápido rodando na porta ${PORT}`)
);
