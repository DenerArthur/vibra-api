import express from "express";
import cors from "cors";
import { Innertube, UniversalCache } from "youtubei.js";

// Node 18 já tem fetch nativo:
const fetch = global.fetch;

const app = express();
app.use(cors());
app.use(express.json());

let yt = null;

// ======================================================
// 1. INICIALIZAÇÃO DO INNERTUBE (ULTRA RÁPIDA)
// ======================================================
(async () => {
  try {
    console.log("🚀 Iniciando Innertube (Proxy Turbo)…");

    yt = await Innertube.create({
      cache: new UniversalCache(),
      generate_session_locally: true,
      retrieve_player: true,      // Tokens avançados
      retrieve_papa: true,        // Necessário p/ vídeos protegidos
      location: "BR",
      lang: "pt",
      device_category: "mobile",
      device_client: "ANDROID"
    });

    console.log("✅ Innertube pronto (modo turbo).");
  } catch (err) {
    console.error("❌ Falha ao iniciar Innertube:", err.message);
  }
})();


// ======================================================
// 2. SMART SEARCH — Garantir que sempre achamos 1 vídeo
// ======================================================
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


// ======================================================
// 3. PROXY ULTRA RÁPIDO (PRE-BUFFER + STREAM CHUNK)
// ======================================================
app.get("/proxy/audio/:id", async (req, res) => {
  try {
    const videoId = req.params.id;

    if (!yt) return res.status(503).send("Motor iniciando…");

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

    // Melhor formato
    formats.sort((a, b) => b.bitrate - a.bitrate);
    const best = formats[0];

    const url = await best.decipher(yt.session);

    // Headers do stream
    res.setHeader("Content-Type", best.mime_type);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-store");

    // =====================================================
    // 80KB PRE-BUFFER — baixa e já envia pro app (instantâneo)
    // =====================================================
    const pre = await fetch(url, { headers: { Range: "bytes=0-80000" } });
    const preBuffer = Buffer.from(await pre.arrayBuffer());
    res.write(preBuffer);

    // =====================================================
    // STREAMING CONTÍNUO — sem buffering total
    // =====================================================
    const st
