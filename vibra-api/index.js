import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

//
// ==========================================================
// INSTÂNCIAS PIPED 2025 — MAIOR LISTA ESTÁVEL
// ==========================================================
const PIPED_LIST = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.nadeko.net",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.smnz.de",
  "https://pa.il.ax",
  "https://piped-api.garudalinux.org",
  "https://pipedapi.in.projectsegfau.lt",
  "https://piped-api.lunar.icu",
  "https://pipedapi.tokhmi.xyz",
  "https://pipedapi.drgns.space",
  "https://pipedapi.nebulacentre.net",
  "https://pipedapi.dedyn.io",
];

//
// ==========================================================
// TESTA INSTÂNCIAS ATÉ FUNCIONAR
// ==========================================================
async function getAudioFromPiped(videoId) {
  for (const base of PIPED_LIST) {
    const url = `${base}/streams/${videoId}`;
    console.log("🔎 Testando Piped:", url);

    try {
      const r = await fetch(url, {
        timeout: 7000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile",
        },
      });

      if (!r.ok) {
        console.log("❌ Instância rejeitou:", base);
        continue;
      }

      const json = await r.json();

      if (!json?.audioStreams?.length) {
        console.log("⚠️ Sem audioStreams:", base);
        continue;
      }

      // Ordena por maior bitrate
      const sorted = json.audioStreams.sort(
        (a, b) => (b.bitrate || 0) - (a.bitrate || 0)
      );

      const best = sorted[0];

      if (best?.url) {
        console.log("🎯 SUCESSO:", base);
        return best.url;
      }

    } catch (e) {
      console.log("💥 Erro nesta instância:", base);
    }
  }

  return null;
}

//
// ==========================================================
// ROTAS
// ==========================================================
app.get("/", (req, res) => {
  res.json({ status: "Vibra API OK" });
});

app.post("/audio", async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return res.json({ success: false, error: "videoId ausente." });
  }

  console.log("🎬 Recebido videoId:", videoId);

  const finalAudio = await getAudioFromPiped(videoId);

  if (!finalAudio) {
    return res.json({
      success: false,
      error: "Não foi possível obter áudio via Piped.",
    });
  }

  res.json({
    success: true,
    url: finalAudio,
  });
});

//
// ==========================================================
// START SERVER
// ==========================================================
app.listen(PORT, () =>
  console.log(`Vibra API rodando na porta ${PORT}`)
);
