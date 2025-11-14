import express from "express";
import cors from "cors";
import { Innertube, UniversalCache } from "youtubei.js";

// Node 18 tem fetch nativo:
const fetch = global.fetch;

const app = express();
app.use(cors());
app.use(express.json());

let yt = null;

// ==========================================
// 1. INICIALIZAÇÃO DO YOUTUBEI.JS (TURBO)
// ==========================================
(async () => {
  try {
    console.log("🚀 Iniciando Innertube (modo turbo)…");

    yt = await Innertube.create({
      cache: new UniversalCache(),
      generate_session_locally: true,
      retrieve_player: true,
      retrieve_papa: true,
      location: "BR",
      lang: "pt",
      device_category: "mobile",
      device_client: "ANDROID"
    });

    console.log("✅ Innertube pronto.");
  } catch (err) {
    console.error("❌ Erro ao iniciar Innertube:", err.message);
  }
})();


// ==========================================
// 2. SMART SEARCH
// ==========================================
async function smartSearch(query) {
  try {
    const result = await yt.search(query);
    return result.results?.find(
      v => (v.type === "Video" || v.type === "CompactVideo") && !v.is_live
    );
  } catch {
    return null;
  }
}


// ==========================================
// 3. PROXY DE ÁUDIO ULTRA RÁPIDO
// ==========================================
app.get("/proxy/audio/:id", async (req, res) => {
  try {
    const videoId = req.params.id;

    if (!yt) return res.status(503).send("Inicializando…");

    console.log(`🎧 Proxy: carregando áudio de ${videoId}`);

    const info = await yt.getBasicInfo(videoId);

    let formats =
      info.streaming_data?.adaptive_formats?.filter(
        f =>
          f.mime_type?.includes("audio") &&
          !f.has_video &&
          f.bitrate > 0
      ) || [];

    if (!formats.length)
      return res.status(403).send("Nenhum formato disponível.");

    formats.sort((a, b) => b.bitrate - a.bitrate);
    const best = formats[0];

    const url = await best.decipher(yt.session);

    res.setHeader("Content-Type", best.mime_type);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-store");

    // 80 KB PRE-BUFFER
    const pre = await fetch(url, { headers: { Range: "bytes=0-80000" } });
    const preBuffer = Buffer.from(await pre.arrayBuffer());
    res.write(preBuffer);

    // STREAM CONTÍNUO
    const stream = await fetch(url);
    stream.body.pipe(res);

  } catch (err) {
    console.error("❌ Proxy erro:", err.message);
    res.status(500).send("Erro interno no proxy.");
  }
});


// ==========================================
// 4. ROTA /audio — converte QUERY → videoId → proxy
// ==========================================
app.post("/audio", async (req, res) => {
  const { query, videoId } = req.body;

  try {
    if (!yt) return res.status(503).json({ error: "Inicializando…" });

    let id = videoId;

    if (!id && query) {
      const result = await smartSearch(query);
      if (!result)
        return res.status(404).json({ error: "Vídeo não encontrado." });
      id = result.id;
    }

    if (!id)
      return res.status(400).json({ error: "videoId ausente" });

    return res.json({
      success: true,
      videoId: id,
      stream: `${req.protocol}://${req.get("host")}/proxy/audio/${id}`
    });

  } catch (err) {
    console.error("❌ Erro ao montar stream:", err.message);
    res.status(500).json({ error: "Erro interno ao gerar áudio." });
  }
});


// ==========================================
// 5. START
// ==========================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🔥 Proxy ultra-rápido rodando na porta ${PORT}`)
);
