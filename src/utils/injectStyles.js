/* Inject Google Fonts and keyframe animations once on module load */
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Share+Tech+Mono&display=swap";
document.head.appendChild(fontLink);

const styleEl = document.createElement("style");
styleEl.textContent = `@keyframes wave{from{height:4px}to{height:16px}}@keyframes aiPulse{0%,100%{box-shadow:0 0 8px rgba(80,140,255,0.15),0 0 0 0 rgba(80,140,255,0)}50%{box-shadow:0 0 18px rgba(80,140,255,0.35),0 0 0 6px rgba(80,140,255,0.06)}}`;
document.head.appendChild(styleEl);
