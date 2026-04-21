/* Static visual overlays: film grain, vignette, and lightning flash */
export function Overlays() {
  return (
    <>
      {/* Film grain */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 5, pointerEvents: "none",
        opacity: 0.3, mixBlendMode: "overlay",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
      }} />

      {/* Vignette */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 6, pointerEvents: "none",
        background: "radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,0.82) 100%)",
      }} />

      {/* Lightning flash — controlled by id from Three.js */}
      <div
        id="lt-flash"
        style={{
          position: "fixed", inset: 0, zIndex: 7, pointerEvents: "none",
          background: "#deeeff", opacity: 0, transition: "opacity 0.04s",
        }}
      />
    </>
  );
}
