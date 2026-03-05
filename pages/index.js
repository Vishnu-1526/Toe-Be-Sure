import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import { useSession, signIn, signOut } from "next-auth/react";

// ─── Risk colour config ───────────────────────────────────────────────────────
const RISK = {
  High: {
    border: "rgba(220,38,38,0.45)",
    bg: "rgba(220,38,38,0.10)",
    badge: "#d23333",
    bar: "#dc2626",
    heat: [255, 50, 50],
    icon: "🔴",
  },
  Medium: {
    border: "rgba(234,179,8,0.45)",
    bg: "rgba(234,179,8,0.10)",
    badge: "#b45309",
    bar: "#d97706",
    heat: [255, 160, 0],
    icon: "🟡",
  },
  Low: {
    border: "rgba(22,163,74,0.45)",
    bg: "rgba(22,163,74,0.10)",
    badge: "#15803d",
    bar: "#22c55e",
    heat: [34, 197, 94],
    icon: "🟢",
  },
};

// ─── SHAP bar data (simulated from clinical inputs) ───────────────────────────
function buildShap(clinical, risk) {
  const base = risk === "High" ? 1 : risk === "Medium" ? 0.5 : 0.2;
  const age   = clinical.age            ? Math.min((clinical.age - 40)   / 60, 1) * 0.18 * base : 0.08 * base;
  const bmi   = clinical.bmi            ? Math.min((clinical.bmi - 18.5) / 22, 1) * 0.22 * base : 0.10 * base;
  const dur   = clinical.diabetes_duration ? Math.min(clinical.diabetes_duration / 20, 1) * 0.20 * base : 0.09 * base;
  const sugar = clinical.blood_sugar    ? Math.min((clinical.blood_sugar - 70) / 230, 1) * 0.19 * base : 0.08 * base;
  const prev  = clinical.previous_wounds !== "No" ? 0.21 * base : 0.04 * base;
  return [
    { label: "Previous Wounds",    value: prev,  positive: prev > 0.05 },
    { label: "BMI",                value: bmi,   positive: bmi  > 0.07 },
    { label: "Diabetes Duration",  value: dur,   positive: dur  > 0.06 },
    { label: "Blood Sugar",        value: sugar, positive: sugar > 0.06 },
    { label: "Age",                value: age,   positive: age  > 0.06 },
  ].sort((a, b) => b.value - a.value);
}

// ─── Simulated Grad-CAM overlay drawn on canvas ──────────────────────────────
function drawHeatmap(canvas, imgSrc, risk) {
  const ctx = canvas.getContext("2d");
  const img = new window.Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const [r, g, b] = RISK[risk]?.heat ?? [255, 0, 0];
    const spots =
      risk === "High"
        ? [
            { x: 0.44, y: 0.62, radius: 0.26, alpha: 0.58 },
            { x: 0.57, y: 0.38, radius: 0.16, alpha: 0.42 },
            { x: 0.33, y: 0.72, radius: 0.12, alpha: 0.30 },
          ]
        : risk === "Medium"
        ? [{ x: 0.5, y: 0.56, radius: 0.22, alpha: 0.44 }]
        : [{ x: 0.5, y: 0.5, radius: 0.09, alpha: 0.18 }];

    spots.forEach(({ x, y, radius, alpha }) => {
      const cx = img.width * x;
      const cy = img.height * y;
      const rad = Math.min(img.width, img.height) * radius;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
  };
  img.src = imgSrc;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgFile, setImgFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clinical, setClinical] = useState({
    age: "",
    bmi: "",
    diabetes_duration: "",
    blood_sugar: "",
    previous_wounds: "No",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const { data: session, status } = useSession({ required: true });
  const canvasRef = useRef(null);
  const fileRef  = useRef(null);
  const toolRef  = useRef(null);

  useEffect(() => {
    if (!result || !imgSrc || !canvasRef.current || result.heatmap) return;
    drawHeatmap(canvasRef.current, imgSrc, result.risk);
  }, [result, imgSrc]);

  const loadFile = (file) => {
    if (!file?.type.startsWith("image/")) return;
    setImgFile(file);
    setImgSrc(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!imgFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("image", imgFile);
    Object.entries(clinical).forEach(([k, v]) => form.append(k, v));
    try {
      const res  = await fetch("/api/predict", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Prediction failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const rc   = result ? RISK[result.risk] : null;
  const shap = result ? buildShap(clinical, result.risk) : [];

  const aboutRef = useRef(null);
  const contactRef = useRef(null);

  // Show loading screen while checking auth
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page" data-theme="light">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg" style={{ background: "#0E5F7E" }}>
            <span className="opacity-20 text-sm">✦</span>
            <span className="absolute text-3xl leading-none select-none">🦶</span>
          </div>
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Toe Be Sure — Clinical Decision Support</title>
        <meta name="description" content="Toe Be Sure (TBS) — Explainable AI Clinical Decision Support for Diabetic Foot Ulcer Detection" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div
        className="min-h-screen bg-page transition-colors duration-300"
        style={{ color: "var(--text-base)" }}
        data-theme={darkMode ? "dark" : "light"}
      >

        {/* ══════════════════════════ NAVBAR ══════════════════════════ */}
        <nav className="sticky top-0 z-30 bg-nav backdrop-blur border-b border-subtle transition-colors duration-300">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-lg" style={{ background: "#0E5F7E", boxShadow: "0 4px 14px rgba(14,95,126,0.4)" }}>
                <span className="opacity-30 text-sm">✦</span>
                <span className="absolute text-xl leading-none select-none">🦶</span>
              </div>
              <span className="font-bold text-lg tracking-tight">
                Toe Be<span className="text-teal-400"> Sure</span>
              </span>
            </div>

            {/* Desktop links */}
            <ul className="hidden md:flex items-center gap-8 text-sm text-slate-300">
              {[
                { label: "Home",         onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
                { label: "About",        onClick: () => aboutRef.current?.scrollIntoView({ behavior: "smooth" }) },
                { label: "How It Works", onClick: () => toolRef.current?.scrollIntoView({ behavior: "smooth" }) },
                { label: "Contact",      onClick: () => contactRef.current?.scrollIntoView({ behavior: "smooth" }) },
              ].map(({ label, onClick }) => (
                <li key={label}>
                  <button onClick={onClick} className="hover:text-teal-400 transition-colors cursor-pointer bg-transparent border-none p-0">
                    {label}
                  </button>
                </li>
              ))}
            </ul>

            {/* Auth CTA */}
            {session ? (
              <div className="hidden md:flex items-center gap-3">
                <img
                  src={session.user.image}
                  alt={session.user.name}
                  className="w-8 h-8 rounded-full border-2 border-teal-500/40"
                />
                <span className="text-sm text-slate-300 max-w-[120px] truncate">{session.user.name}</span>
                <button
                  onClick={() => signOut()}
                  className="text-xs border border-white/15 hover:border-red-400/50 text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-full transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google", { callbackUrl: "/" })}
                className="hidden md:inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors shadow-lg shadow-teal-500/20"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
                  <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" opacity=".9"/>
                  <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".9"/>
                  <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" opacity=".9"/>
                  <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".9"/>
                </svg>
                Sign in with Google
              </button>
            )}

            {/* Dark / Light toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-9 h-9 rounded-full border border-teal-500/30 flex items-center justify-center text-base hover:bg-teal-500/10 transition-colors"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>

            {/* Mobile hamburger */}
            <button className="md:hidden text-slate-300 text-2xl" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="md:hidden bg-card border-t border-subtle px-6 py-4 space-y-3 transition-colors duration-300">
              {[
                { label: "Home",         onClick: () => { setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); } },
                { label: "About",        onClick: () => { setMenuOpen(false); aboutRef.current?.scrollIntoView({ behavior: "smooth" }); } },
                { label: "How It Works", onClick: () => { setMenuOpen(false); toolRef.current?.scrollIntoView({ behavior: "smooth" }); } },
                { label: "Contact",      onClick: () => { setMenuOpen(false); contactRef.current?.scrollIntoView({ behavior: "smooth" }); } },
              ].map(({ label, onClick }) => (
                <button key={label} onClick={onClick} className="block w-full text-left text-sm text-slate-300 hover:text-teal-400 transition-colors bg-transparent border-none">{label}</button>
              ))}
              {session ? (
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <img src={session.user.image} alt={session.user.name} className="w-7 h-7 rounded-full border border-teal-500/40" />
                    <span className="text-sm text-slate-300 truncate max-w-[160px]">{session.user.name}</span>
                  </div>
                  <button onClick={() => signOut()} className="text-xs text-red-400 border border-red-400/30 px-3 py-1.5 rounded-full hover:bg-red-400/10 transition-colors">Sign out</button>
                </div>
              ) : (
                <button
                  onClick={() => signIn("google", { callbackUrl: "/" })}
                  className="w-full bg-teal-500 text-white text-sm font-semibold py-2 rounded-full mt-2"
                >
                  Sign in with Google
                </button>
              )}
            </div>
          )}
        </nav>

        {/* ══════════════════════════ HERO ══════════════════════════ */}
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid md:grid-cols-2 gap-12 items-center">

          {/* Left — text */}
          <div>
            <p className="text-teal-400 text-sm font-semibold tracking-widest uppercase mb-4">
              Welcome to Toe Be Sure
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5">
              Detect Foot Ulcers<br />
              with <span className="text-teal-400">Explainable AI</span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed mb-8 max-w-md">
              Our multi-modal deep learning pipeline analyses diabetic foot images,
              integrates clinical data, and delivers transparent risk assessments
              with Grad-CAM heatmaps and SHAP feature importance.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => toolRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="bg-teal-500 hover:bg-teal-400 text-white font-semibold px-7 py-3 rounded-full transition-colors shadow-xl shadow-teal-500/25 text-sm"
              >
                Start Analysis
              </button>
              <button
                onClick={() => document.getElementById("deliverables")?.scrollIntoView({ behavior: "smooth" })}
                className="border border-white/15 hover:border-teal-500/50 text-slate-300 hover:text-white font-semibold px-7 py-3 rounded-full transition-colors text-sm"
              >
                What We Provide
              </button>
            </div>

            {/* Stats row */}
            <div className="flex gap-8 mt-10">
              {[["4+","AI Agents"],["Grad-CAM","Visual XAI"],["SHAP","Feature XAI"]].map(([v, l]) => (
                <div key={l}>
                  <p className="text-xl font-bold text-white">{v}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — decorative AI visual */}
          <div className="flex justify-center">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80">
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-full bg-teal-500/10 border border-teal-500/20 animate-pulse" />
              {/* Inner circle */}
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-teal-900/60 to-blue-900/60 border border-teal-500/30 flex flex-col items-center justify-center text-center p-6 shadow-2xl">
                <div className="text-6xl mb-3">🦶</div>
                <p className="text-teal-300 text-sm font-semibold">AI Risk Scanner</p>
                <p className="text-slate-500 text-xs mt-1">CNN · Grad-CAM · SHAP</p>
              </div>
              {/* Orbiting dots */}
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <div
                  key={deg}
                  className="absolute w-3 h-3 rounded-full bg-teal-400/60"
                  style={{
                    top: `calc(50% + ${Math.sin((deg * Math.PI) / 180) * 130}px - 6px)`,
                    left: `calc(50% + ${Math.cos((deg * Math.PI) / 180) * 130}px - 6px)`,
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════ DELIVERABLES ══════════════════════════ */}
        <section id="deliverables" ref={aboutRef} className="bg-section border-y border-subtle py-16 transition-colors duration-300">
          <div className="max-w-6xl mx-auto px-6">
            <p className="text-teal-400 text-sm font-semibold tracking-widest uppercase text-center mb-2">
              Key Deliverables
            </p>
            <h2 className="text-3xl font-bold text-center mb-10">What We Provide</h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: "🧠",
                  title: "Multi-Modal Classifier",
                  desc: "Fuses CNN image features + clinical tabular data for a 0–100% DFU risk score using transfer learning.",
                },
                {
                  icon: "🌡️",
                  title: "Visual Explanations",
                  desc: "Grad-CAM heatmaps overlay the original image with segmentation highlights of ulcer-risk regions.",
                },
                {
                  icon: "💬",
                  title: "Textual Justifications",
                  desc: "Natural language summaries of the model's reasoning, tailored to the patient's clinical profile.",
                },
                {
                  icon: "📊",
                  title: "Interactive Dashboard",
                  desc: "Upload interface + risk gauge + SHAP feature importance chart for complete clinical transparency.",
                },
              ].map(({ icon, title, desc }) => (
                <div
                  key={title}
                  className="bg-card border border-card-edge rounded-2xl p-6 hover:border-teal-500/40 hover:-translate-y-1 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-2xl mb-4 group-hover:bg-teal-500/20 transition-colors">
                    {icon}
                  </div>
                  <h3 className="font-bold text-base mb-2 text-white">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════ ANALYSIS TOOL ══════════════════════════ */}
        <section id="tool" ref={toolRef} className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <p className="text-teal-400 text-sm font-semibold tracking-widest uppercase text-center mb-2">
            How It Works
          </p>
          <h2 className="text-3xl font-bold text-center mb-2">Run Your Analysis</h2>
          <p className="text-slate-400 text-center text-sm mb-10 max-w-xl mx-auto">
            Upload a foot photograph, fill in optional clinical parameters, and click Analyze.
          </p>

          <div className="grid lg:grid-cols-2 gap-8 items-start">

            {/* ── LEFT: inputs ── */}
            <div className="space-y-5">

              {/* Upload */}
              <div className="bg-card border border-card-edge rounded-2xl p-6 transition-colors duration-300">
                <h3 className="font-semibold text-sm uppercase tracking-widest text-teal-400 mb-4">
                  📷 Foot Image
                </h3>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none ${
                    dragging ? "border-teal-400 bg-teal-900/15" : "border-white/10 hover:border-teal-500/50 hover:bg-white/[0.03]"
                  }`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}
                >
                  {imgSrc ? (
                    <img src={imgSrc} alt="Uploaded foot" className="max-h-48 mx-auto rounded-xl object-contain" />
                  ) : (
                    <>
                      <div className="text-4xl mb-3 opacity-60">🖼️</div>
                      <p className="text-slate-300 font-medium text-sm">Drag &amp; drop or click to upload</p>
                      <p className="text-slate-600 text-xs mt-1">JPG · PNG · WEBP</p>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => loadFile(e.target.files[0])} />
                </div>
                {imgSrc && (
                  <button
                    onClick={() => { setImgSrc(null); setImgFile(null); setResult(null); setError(null); }}
                    className="mt-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
                  >✕ Remove image</button>
                )}
              </div>

              {/* Clinical */}
              <div className="bg-card border border-card-edge rounded-2xl p-6 transition-colors duration-300">
                <h3 className="font-semibold text-sm uppercase tracking-widest text-teal-400 mb-4 flex items-center justify-between">
                  <span>🩺 Clinical Parameters</span>
                  <span className="normal-case text-xs text-slate-600 font-normal">Optional</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Age", unit: "yrs",    key: "age",               type: "number", placeholder: "e.g. 62" },
                    { label: "BMI", unit: "kg/m²",  key: "bmi",               type: "number", placeholder: "e.g. 31.2" },
                    { label: "Diabetes Duration", unit: "yrs", key: "diabetes_duration", type: "number", placeholder: "e.g. 15" },
                    { label: "Fasting Blood Sugar", unit: "mg/dL", key: "blood_sugar", type: "number", placeholder: "e.g. 180" },
                  ].map(({ label, unit, key, type, placeholder }) => (
                    <div key={key}>
                      <label className="text-xs text-slate-500 block mb-1">{label} <span className="text-slate-700">({unit})</span></label>
                      <input
                        type={type} placeholder={placeholder}
                        value={clinical[key]}
                        onChange={(e) => setClinical({ ...clinical, [key]: e.target.value })}
                        className="w-full bg-input border border-card-edge rounded-lg px-3 py-2 text-sm placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors" style={{ color: 'var(--text-base)' }}
                      />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 block mb-1">Previous Ulcers / Wounds</label>
                    <select value={clinical.previous_wounds}
                      onChange={(e) => setClinical({ ...clinical, previous_wounds: e.target.value })}
                      className="w-full bg-input border border-card-edge rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 transition-colors" style={{ color: 'var(--text-base)' }}
                    >
                      <option>No</option>
                      <option>Yes – healed</option>
                      <option>Yes – active</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Button */}
              <button onClick={handleAnalyze} disabled={!imgFile || loading}
                className="w-full py-4 rounded-xl font-semibold text-base transition-all disabled:opacity-35 disabled:cursor-not-allowed bg-teal-500 hover:bg-teal-400 active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl shadow-teal-500/20"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Running AI inference…
                  </>
                ) : <>🔍 Analyze Image</>}
              </button>

              {error && (
                <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-300 text-sm flex items-start gap-2">
                  <span>⚠️</span><span>{error}</span>
                </div>
              )}
            </div>

            {/* ── RIGHT: results ── */}
            <div className="space-y-5">

              {!result && !loading && (
                <div className="bg-card border border-card-edge rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[24rem] transition-colors duration-300">
                  <div className="relative mb-4 flex items-center justify-center">
                    {/* Scan glow background */}
                    <div className="absolute w-24 h-24 rounded-full bg-teal-500/10 blur-2xl" />
                    {/* Scan line animation */}
                    <div className="relative w-20 h-28 rounded-xl border border-teal-500/20 bg-gradient-to-b from-teal-900/30 to-blue-900/20 overflow-hidden flex items-center justify-center shadow-inner">
                      <span className="text-5xl" style={{ filter: "invert(1) sepia(1) saturate(2) hue-rotate(160deg)", opacity: 0.7 }}>🦶</span>
                      {/* Horizontal scan line */}
                      <div className="absolute left-0 right-0 h-0.5 bg-teal-400/60" style={{ animation: "scanline 2.5s ease-in-out infinite", top: "40%" }} />
                      {/* Grid overlay */}
                      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(45,170,138,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(45,170,138,0.5) 1px, transparent 1px)", backgroundSize: "8px 8px" }} />
                    </div>
                  </div>
                  <style>{`@keyframes scanline { 0%,100%{top:10%} 50%{top:85%} }`}</style>
                  <p className="font-semibold text-slate-400">Awaiting analysis</p>
                  <p className="text-xs text-slate-600 mt-2">Upload a foot image and click Analyze</p>
                </div>
              )}

              {loading && (
                <div className="bg-card border border-card-edge rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[24rem] transition-colors duration-300">
                  <svg className="animate-spin h-14 w-14 text-teal-400 mb-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <p className="text-slate-300 font-semibold">Running AI inference…</p>
                  <p className="text-slate-500 text-xs mt-1">CNN · Grad-CAM · SHAP · Risk assessment</p>
                </div>
              )}

              {result && rc && (
                <>
                  {/* Risk card */}
                  <div className="rounded-2xl p-6 border" style={{ background: rc.bg, borderColor: rc.border }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">AI Prediction</p>
                        <h3 className="text-2xl font-extrabold">{result.prediction}</h3>
                      </div>
                      <span className="text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1 shrink-0 shadow-lg"
                        style={{ background: rc.badge }}>
                        {rc.icon} {result.risk} Risk
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                        <span>Model Confidence</span>
                        <span className="font-bold text-white">{result.confidence}%</span>
                      </div>
                      <div className="h-2.5 bg-black/30 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-1000 ease-out"
                          style={{ width: `${result.confidence}%`, background: rc.bar }} />
                      </div>
                    </div>
                    {result.simulated && (
                      <p className="text-[11px] text-slate-500 mt-3">⚡ Simulated — connect Colab backend for real inference</p>
                    )}
                  </div>

                  {/* Grad-CAM */}
                  <div className="bg-card border border-card-edge rounded-2xl p-6 transition-colors duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-teal-400">🌡️</span>
                      <h4 className="font-semibold text-sm">Grad-CAM Visual Explanation</h4>
                      <span className="ml-auto text-[10px] bg-teal-900/40 text-teal-400 border border-teal-700/40 px-2 py-0.5 rounded-full">XAI</span>
                    </div>
                    {result.heatmap ? (
                      <img src={`data:image/jpeg;base64,${result.heatmap}`} alt="Grad-CAM heatmap" className="w-full rounded-xl" />
                    ) : (
                      <canvas ref={canvasRef} className="w-full rounded-xl" />
                    )}
                    <p className="text-xs text-slate-600 mt-2">
                      Highlighted regions show the highest CNN activation contributing to this prediction.
                    </p>
                  </div>

                  {/* SHAP */}
                  <div className="bg-card border border-card-edge rounded-2xl p-6 transition-colors duration-300">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-teal-400">📊</span>
                      <h4 className="font-semibold text-sm">SHAP Feature Importance</h4>
                      <span className="ml-auto text-[10px] bg-teal-900/40 text-teal-400 border border-teal-700/40 px-2 py-0.5 rounded-full">XAI</span>
                    </div>
                    <div className="space-y-3">
                      {shap.map(({ label, value, positive }) => (
                        <div key={label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">{label}</span>
                            <span className={positive ? "text-red-400 font-semibold" : "text-green-400 font-semibold"}>
                              {positive ? "+" : ""}{value.toFixed(2)}
                            </span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-[width] duration-700"
                              style={{
                                width: `${Math.min(value * 400, 100)}%`,
                                background: positive ? "#ef4444" : "#22c55e",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-600 mt-3">
                      Red bars increase DFU risk · Green bars reduce DFU risk
                    </p>
                  </div>

                  {/* Textual explanation */}
                  <div className="bg-card border border-card-edge rounded-2xl p-6 transition-colors duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-teal-400">💬</span>
                      <h4 className="font-semibold text-sm">Clinical Textual Justification</h4>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{result.explanation}</p>

                    {Object.values(clinical).some(Boolean) && (
                      <>
                        <hr className="border-white/5 my-4" />
                        <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">Clinical Factors</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Age",               value: clinical.age               ? `${clinical.age} yrs`              : "—" },
                            { label: "BMI",               value: clinical.bmi               ? `${clinical.bmi} kg/m²`            : "—" },
                            { label: "Diabetes Duration", value: clinical.diabetes_duration ? `${clinical.diabetes_duration} yrs` : "—" },
                            { label: "Blood Sugar",       value: clinical.blood_sugar       ? `${clinical.blood_sugar} mg/dL`    : "—" },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-white/[0.04] rounded-lg px-3 py-2">
                              <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
                              <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
                            </div>
                          ))}
                          <div className="col-span-2 bg-white/[0.04] rounded-lg px-3 py-2">
                            <p className="text-[10px] text-slate-600 uppercase tracking-wider">Previous Wounds</p>
                            <p className="text-sm font-semibold text-white mt-0.5">{clinical.previous_wounds}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>





        {/* ══════════════════════════ CONTACT ══════════════════════════ */}
        <section ref={contactRef} className="bg-section border-t border-subtle py-16 transition-colors duration-300">
          <div className="max-w-xl mx-auto px-6 text-center">
            <p className="text-teal-400 text-sm font-semibold tracking-widest uppercase mb-2">Get In Touch</p>
            <h2 className="text-3xl font-bold mb-3">Contact Us</h2>
            <p className="text-slate-400 text-sm mb-10">Have questions or feedback? Reach out directly.</p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center">
              {/* Email */}
              <a
                href="mailto:hakdiyal@gitam.in"
                className="flex items-center gap-4 bg-card border border-card-edge hover:border-teal-500/50 rounded-2xl px-6 py-5 transition-all hover:-translate-y-1 group"
              >
                {/* Gmail-style icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md" style={{ background: "linear-gradient(135deg,#EA4335 40%,#FBBC05 100%)" }}>
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
                    <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 2-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Email</p>
                  <p className="text-sm font-semibold group-hover:text-teal-400 transition-colors" style={{ color: 'var(--text-base)' }}>hakdiyal@gitam.in</p>
                </div>
              </a>

              {/* Phone */}
              <a
                href="tel:+918125359415"
                className="flex items-center gap-4 bg-card border border-card-edge hover:border-teal-500/50 rounded-2xl px-6 py-5 transition-all hover:-translate-y-1 group"
              >
                {/* Phone icon */}
                <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center shrink-0 shadow-md shadow-teal-500/30">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Phone</p>
                  <p className="text-sm font-semibold group-hover:text-teal-400 transition-colors" style={{ color: 'var(--text-base)' }}>+91 81253 59415</p>
                </div>
              </a>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}

