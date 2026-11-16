
import { useEffect, useState } from "react";

// Retorna o horário atual e atualiza periodicamente.
export function useNow(ms: number = 30000): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = Number.isFinite(ms) && ms > 0 ? ms : 30000;

    const id = setInterval(() => {
      setNow(Date.now());
    }, interval);

    return () => clearInterval(id);
  }, [ms]);

  return now;
}
