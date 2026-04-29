/* Inject Google Fonts and keyframe animations once on module load */
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Share+Tech+Mono&display=swap";
document.head.appendChild(fontLink);

const styleEl = document.createElement("style");
styleEl.textContent = `@keyframes wave{from{height:4px}to{height:16px}}@keyframes aiPulse{0%,100%{box-shadow:0 0 18px rgba(100,170,255,0.45),0 0 0 0 rgba(100,170,255,0.35),0 6px 18px rgba(0,0,0,0.55)}50%{box-shadow:0 0 36px rgba(140,200,255,0.85),0 0 0 12px rgba(100,170,255,0.0),0 6px 18px rgba(0,0,0,0.55)}}`;
document.head.appendChild(styleEl);
