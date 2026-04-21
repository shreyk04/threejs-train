/* Inject Google Fonts and keyframe animations once on module load */
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Share+Tech+Mono&display=swap";
document.head.appendChild(fontLink);

const styleEl = document.createElement("style");
styleEl.textContent = `@keyframes wave{from{height:4px}to{height:16px}}`;
document.head.appendChild(styleEl);
