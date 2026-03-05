<div align="center">

<img src="https://em-content.zobj.net/source/apple/391/foot_1f9b6.png" width="80" alt="foot emoji" />

# Toe Be Sure (TBS)

### AI-Powered Diabetic Foot Ulcer Detection

[![Live App](https://img.shields.io/badge/Live%20App-toe--be--sure.vercel.app-0E7490?style=for-the-badge&logo=vercel)](https://toe-be-sure.vercel.app)
[![Framework](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![AI Model](https://img.shields.io/badge/Model-ResNet18-EF4444?style=for-the-badge&logo=pytorch)](https://pytorch.org)

</div>

---

## 🔗 Links

| | |
|---|---|
| 🌐 **Live App** | https://toe-be-sure.vercel.app |
| 📖 **User Manual** | https://toe-be-sure.vercel.app/TBS_User_Manual.html |
| 🤖 **AI Backend** | https://github.com/kharsha006/hackathon_dfu |

---

## 🦶 What is Toe Be Sure?

**Toe Be Sure (TBS)** is a clinical decision support web app that uses deep learning to detect **Diabetic Foot Ulcers (DFUs)** from foot photographs. Upload an image, get an instant AI-powered risk assessment — complete with visual heatmaps and plain-English explanations.


---

## ✨ Features

- 🔴🟡🟢 **Risk classification** — High / Medium / Low DFU risk score
- 🌡️ **Grad-CAM heatmaps** — highlights exactly where the AI detected concern
- 📊 **SHAP feature importance** — shows which clinical factors drove the result
- 💬 **Textual justification** — plain-English summary of the AI's reasoning
- 🔒 **Google Sign-In** — secure authentication via NextAuth.js
- 🌙 **Dark / Light mode** toggle
- 📱 **Fully responsive** — works on mobile, tablet, and desktop

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS v4 |
| Auth | NextAuth.js + Google OAuth 2.0 |
| AI Model | ResNet18 (PyTorch), fine-tuned on DFU dataset |
| Visual XAI | Grad-CAM (pytorch-grad-cam) |
| AI Serving | Flask + ngrok on Google Colab |
| Deployment | Vercel |

---

## 🧠 How It Works

```
📷 Foot Photo  →  Browser  →  Vercel API  →  Colab (ResNet18 + Grad-CAM)  →  📊 Results
```

1. User uploads a foot image and optional clinical data (age, BMI, blood sugar, etc.)
2. Image is forwarded from the Vercel API route to a Flask server running on Google Colab
3. ResNet18 classifies the image and Grad-CAM generates the heatmap
4. Risk level, confidence score, heatmap, and explanation are returned instantly

---

## 🤖 AI Backend (Google Colab)

The AI model runs in `tbs_api_server.ipynb`. Open it in Colab and run all 4 cells:

1. Install dependencies
2. Download `best_dfu.pt` model from GitHub
3. Load ResNet18 + transforms
4. Start Flask + ngrok — the live URL is printed in the output

Set `COLAB_URL` in Vercel environment variables to that URL and redeploy.

---

## 👥 Team — Kodrxy Hackathon 2025–2026

| contributors |
|---|---|
|[Vishnu-1526](https://github.com/Vishnu-1526) |
|[kharsha006](https://github.com/kharsha006) | 
|[GH2023003041](https://github.com/GH2023003041)|
|[Nani2054](https://github.com/Nani2054)|
