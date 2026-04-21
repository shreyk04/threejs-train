import { serif } from "../styles/shared";

export function Toast({ toast }) {
  return (
    <div style={{
      position: "fixed", top: "50%", left: "50%",
      transform: "translate(-50%,-50%)", zIndex: 100,
      pointerEvents: "none",
      fontFamily: serif, fontStyle: "italic",
      fontSize: "clamp(1rem,2.5vw,1.5rem)",
      color: "rgba(200,225,255,.9)", textAlign: "center",
      letterSpacing: "0.08em",
      opacity: toast ? 1 : 0, transition: "opacity .5s",
    }}>
      {toast}
    </div>
  );
}
