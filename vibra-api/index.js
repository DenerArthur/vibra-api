import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// TESTE
app.get("/", (req, res) => {
  res.json({ status: "Vibra API OK" });
});

// ROTA PARA PEGAR ÁUDIO VIA COBALT
app.get("/audio", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ success: false, error: "Missing URL." });
    }

    const api = "https://api.cobalt.tools/api/json";

    const response = await fetch(api, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        downloadMode: "audio",
        vCodec: "none"
      })
    });

    const json = await response.json();
    return res.json(json);

  } catch (e) {
    console.log("ERRO:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => console.log(`🔥 Vibra API rodando na porta ${PORT}`));
