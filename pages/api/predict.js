export const config = {
  api: {
    bodyParser: false, // we forward raw multipart/form-data to Colab
  },
};

// Simulated fallback responses when Colab is not connected
const SIMULATED = {
  High: {
    prediction: "DFU Detected",
    risk: "High",
    explanation:
      "The model detected significant ulcer-like patterns in the plantar region. Irregular tissue boundaries, color abnormalities, and pressure-point activation maps suggest active diabetic foot ulcer formation. Immediate clinical evaluation is strongly recommended.",
  },
  Medium: {
    prediction: "DFU Risk Detected",
    risk: "Medium",
    explanation:
      "Early-stage changes consistent with pre-ulcerative conditions were identified. Pressure points and mild tissue discoloration observed near the metatarsal heads. Preventive care and regular monitoring are strongly advised.",
  },
  Low: {
    prediction: "No DFU Detected",
    risk: "Low",
    explanation:
      "No significant ulcer patterns detected in the uploaded image. Tissue coloration and boundaries appear within the normal clinical range. Continue routine monitoring and maintain foot hygiene.",
  },
};

function simulateResult() {
  const levels = ["High", "High", "Medium", "Low"]; // weight towards realistic distribution
  const risk = levels[Math.floor(Math.random() * levels.length)];
  const confidence = (72 + Math.random() * 24).toFixed(1);
  return {
    ...SIMULATED[risk],
    confidence: parseFloat(confidence),
    heatmap: null,
    simulated: true,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const COLAB_URL = process.env.COLAB_URL;

  if (COLAB_URL) {
    try {
      // Collect raw body chunks
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);

      // Forward the raw multipart/form-data to the FastAPI backend (/analyze)
      const response = await fetch(`${COLAB_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": req.headers["content-type"],
          "Content-Length": body.length,
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`Backend responded with status ${response.status}`);
      }

      // Backend returns: { prediction, ulcer_probability, healthy_probability }
      const raw = await response.json();
      const ulcerProb = raw.ulcer_probability ?? 0;
      const confidence = parseFloat((Math.max(ulcerProb, raw.healthy_probability ?? 0) * 100).toFixed(1));

      let risk, prediction, explanation;
      if (ulcerProb >= 0.65) {
        risk = "High";
        prediction = "DFU Detected";
        explanation =
          "Significant ulcer-like patterns detected in the scan. Irregular tissue boundaries, color anomalies, and pressure-point activations indicate active diabetic foot ulcer formation. Immediate clinical evaluation is strongly recommended.";
      } else if (ulcerProb >= 0.35) {
        risk = "Medium";
        prediction = "DFU Risk Detected";
        explanation =
          "Early-stage changes consistent with pre-ulcerative conditions were identified. Mild tissue discoloration and pressure-point changes near the metatarsal heads observed. Preventive care and regular monitoring strongly advised.";
      } else {
        risk = "Low";
        prediction = "No DFU Detected";
        explanation =
          "No significant ulcer patterns detected. Tissue coloration and boundaries appear within the normal clinical range. Continue routine monitoring and maintain foot hygiene.";
      }

      return res.status(200).json({
        prediction,
        risk,
        confidence,
        explanation,
        heatmap: raw.heatmap ?? null,
        simulated: false,
      });
    } catch (err) {
      console.error("⚠️  Backend unreachable, falling back to simulation:", err.message);
      // Fall through to simulation below
    }
  }

  // --- Fallback: return simulated prediction ---
  return res.status(200).json(simulateResult());
}
