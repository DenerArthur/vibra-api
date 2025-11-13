import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.json({ status: "Vibra API OK" });
});

// Instâncias Piped
const PIPED = [
  "https://pipedapi.adminforge.de",
  "https://pipedapi.nadeko.net",
  "https://pipedapi.reallyaweso.me",
];

async function getPipedAudio(videoId) {
  for (const base of PIPED) {
    try {
      const r = await fetch(`${base}/streams/${videoId}`);
      if (!r.ok) continue;

      const json = await r.json();
      console.log("🔵 PIPE RESPONSE:", json);

      if (json?.audioStreams?.length) {
        const best = json.audioStreams.sort(
          (a, b) => b.bitrate - a.bitrate
        )[0];

        if (best?.url) return best.url;
      }
    } catch (e) {
      console.log("Erro Piped:", e);
      continue;
    }
  }
  return null;
}

app.post("/audio", async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return res.json({ success: false, error: "videoId ausente." });
  }

  console.log("🎬 Recebido videoId:", videoId);

  const url = await getPipedAudio(videoId);

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Não foi possível obter áudio via Piped."
    });
  }

  return res.json({ success: true, url });
});

app.listen(PORT, () =>
  console.log(`Vibra API rodando na porta ${PORT}`)
);
