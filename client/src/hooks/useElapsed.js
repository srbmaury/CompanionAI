import { useEffect, useRef, useState } from "react";

const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export const useElapsed = () => {
    const startRef = useRef(Date.now());
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
        return () => clearInterval(id);
    }, []);
    return fmt(elapsed);
};
