export const mono = "'Share Tech Mono', monospace";
export const serif = "'IM Fell English', serif";

export const sliderStyle = {
  width: "100%",
  height: 3,
  appearance: "none",
  background: "rgba(100,150,200,.22)",
  borderRadius: 2,
  outline: "none",
  cursor: "pointer",
  accentColor: "rgba(150,200,240,.82)",
};

export const btnStyle = (active) => ({
  fontFamily: mono,
  fontSize: "0.44rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  background: active ? "rgba(100,180,240,.18)" : "rgba(100,150,200,.1)",
  border: `1px solid ${active ? "rgba(100,180,240,.48)" : "rgba(100,150,200,.22)"}`,
  color: active ? "rgba(180,220,255,1)" : "rgba(180,210,240,.65)",
  padding: "0.38rem 0.85rem",
  borderRadius: 6,
  cursor: "pointer",
  transition: "all .2s",
  whiteSpace: "nowrap",
});
