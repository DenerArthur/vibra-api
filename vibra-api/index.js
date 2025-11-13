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

app.post("/audio", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.json({ success: false, error: "URL ausente." });
  }

  try {
    const reqBody = {
      url,
      downloadMode: "audio",
      vCodec: "none"
    };

    const r = await fetch("https://api.cobalt.tools/api/json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(reqBody),
    });

    // Tenta parsear JSON
    let json;
    try {
      json = await r.json();
    } catch (e) {
      console.log("⚠️ Cobalt retornou HTML ou resposta inválida:");
      const text = await r.text();
      console.log(text);

      return res.status(500).json({
        success: false,
        error: "Cobalt retornou HTML ou resposta inválida."
      });
    }

    console.log("🔵 Resposta do Cobalt:", json);

    if (!json || !json.url) {
      return res.status(400).json({
        success: false,
        error: json?.error || "Não foi possível obter o áudio.",
      });
    }

    return res.json({ success: true, url: json.url });

  } catch (e) {
    console.log("❌ Erro interno:", e);
    return res.status(500).json({
      success: false,
      error: e.message || "Erro interno."
    });
  }
});

app.listen(PORT, () =>
  console.log(`Vibra API rodando na porta ${PORT}`)
);
