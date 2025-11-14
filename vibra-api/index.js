import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ==========================================================
// CONFIG AVANÇADA
// ==========================================================

// Lista de instâncias Piped atualizada e priorizada (2025)
const PIPED_LIST = [
  "https://pipedapi.drgns.space",      // Geralmente a mais rápida
  "https://pipedapi.tokhmi.xyz",       // Muito estável
  "https://pipedapi.kavin.rocks",      // Original, boa fallback
  "https://pa.il.ax",                  // Rápida (Europa)
  "https://pipedapi.smnz.de",          // Estável
  "https://piped-api.lunar.icu",       // Alternativa
  "https://pipedapi.adminforge.de",    // Fallback
  "https://api.piped.privacy.com.de"   // Fallback final
];

// Rotação de User-Agents para evitar bloqueio por "bot"
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
];

function getRandomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ==========================================================
// LÓGICA DE EXTRAÇÃO (RETRY & FAILOVER)
// ==========================================================
async function getAudioFromPiped(videoId) {
  for (const base of PIPED_LIST) {
    const url = `${base}/streams/${videoId}`;
    console.log(`🔎 [Server] Tentando: ${base}`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const r = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": getRandomAgent(),
        },
      });

      clearTimeout(timeout);

      if (r.status === 403 || r.status === 429) {
        console.log(`⛔ Bloqueado/RateLimit (${r.status}) em: ${base}`);
        continue;
      }

      if (!r.ok) {
        console.log(`❌ Erro HTTP ${r.status} em: ${base}`);
        continue;
      }

      const json = await r.json();

      if (!json?.audioStreams?.length) {
        console.log(`⚠️ JSON válido, mas sem 'audioStreams' em: ${base}`);
        continue;
      }

      // Prioridade: M4A > WebM, Maior Bitrate
      const sorted = json.audioStreams.sort((a, b) => {
        // Se formatos diferentes, prefira m4a (melhor compatibilidade nativa iOS/Android)
        if (a.format === 'm4a' && b.format !== 'm4a') return -1;
        if (a.format !== 'm4a' && b.format === 'm4a') return 1;
        // Se formato igual, maior bitrate vence
        return (b.bitrate || 0) - (a.bitrate || 0);
      });

      const best = sorted[0];

      if (best?.url) {
        console.log(`🎯 SUCESSO em ${base} | Bitrate: ${best.bitrate/1000}kbps | Fmt: ${best.format}`);
        return best.url;
      }

    } catch (e) {
      console.log(`💥 Exception em ${base}: ${e.message}`);
    }
  }

  return null;
}

// ==========================================================
// ROTAS
// ==========================================================
app.get("/", (req, res) => {
  res.json({ status: "Vibra API Online", instances: PIPED_LIST.length });
});

app.post("/audio", async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ success: false, error: "videoId missing" });
  }

  console.log(`\n🎬 Request Audio: ${videoId}`);
  const finalAudio = await getAudioFromPiped(videoId);

  if (!finalAudio) {
    console.log("💀 FALHA TOTAL: Nenhuma instância retornou áudio.");
    return res.status(500).json({
      success: false,
      error: "All instances failed to retrieve audio.",
    });
  }

  res.json({
    success: true,
    url: finalAudio,
  });
});

// START
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
