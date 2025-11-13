import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/audio", async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) return res.json({ error: "Missing videoId" });

  const endpoints = [
    "https://api.cobalt.tools/api/json",
    "https://co.wuk.sh/api/json",
  ];

  for (const ep of endpoints) {
    try {
      const response = await fetch(ep, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: "audio",
          vCodec: "none",
        }),
      });

      const json = await response.json();
      if (json.url) return res.json({ url: json.url });
    } catch (e) {
      console.log("Erro no endpoint:", ep);
    }
  }

  return res.json({ error: "No audio found" });
});

app.listen(3000, () => console.log("API online na porta 3000"));
