import { Button } from "@mui/material";

const SkipRoundButton = ({ onSkip }) => {
    const handleClick = async () => {
        const ok = window.confirm(
            "Skip this round? This will delete the round and its questions."
        );
        if (!ok) return;
        await onSkip?.();
    };
    return (
        <Button color="error" variant="outlined" onClick={handleClick}>
            Skip Round
        </Button>
    );
};

export default SkipRoundButton;
