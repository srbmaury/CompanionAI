import { Box } from "@mui/material";

const DELAYS = [0, 100, 50, 150, 80];

const SoundWave = ({ active }) => (
    <Box sx={{
        display: "flex",
        gap: "3px",
        alignItems: "center",
        height: 28,
        "@keyframes soundWave": {
            "0%,100%": { transform: "scaleY(0.3)" },
            "50%": { transform: "scaleY(1)" },
        },
    }}>
        {DELAYS.map((delay, i) => (
            <Box
                key={i}
                sx={{
                    width: 3,
                    height: 22,
                    bgcolor: "primary.light",
                    borderRadius: 1,
                    transformOrigin: "center",
                    transform: "scaleY(0.3)",
                    opacity: active ? 0.85 : 0.2,
                    animation: active ? "soundWave 0.75s ease-in-out infinite" : "none",
                }}
                style={{ animationDelay: `${delay}ms` }}
            />
        ))}
    </Box>
);

export default SoundWave;
