import { useState, useEffect } from "react";

export function useClock() {
  const [clock, setClock] = useState("23:47");

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock(
        String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0")
      );
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  return clock;
}
