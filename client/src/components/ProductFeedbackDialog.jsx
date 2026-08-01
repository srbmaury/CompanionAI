import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from "@mui/material";
import api from "../api/axios";

export default function ProductFeedbackDialog({ open, onClose }) {
    const [category, setCategory] = useState("idea");
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    const close = () => { if (!saving) { setStatus(null); onClose(); } };
    const submit = async () => {
        try {
            setSaving(true); setStatus(null);
            await api.post("/product-feedback", { category, message: message.trim(), page: window.location.pathname });
            setMessage(""); setCategory("idea");
            setStatus({ severity: "success", text: "Thanks — your feedback was sent." });
        } catch (error) {
            setStatus({ severity: "error", text: error?.response?.data?.message || "Feedback could not be sent." });
        } finally { setSaving(false); }
    };

    return <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="product-feedback-title">
        <DialogTitle id="product-feedback-title">Share product feedback</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}>
            {status && <Alert severity={status.severity}>{status.text}</Alert>}
            <TextField select label="Feedback type" value={category} onChange={(e) => setCategory(e.target.value)}>
                <MenuItem value="idea">Idea or request</MenuItem><MenuItem value="problem">Problem</MenuItem><MenuItem value="praise">What works well</MenuItem><MenuItem value="other">Other</MenuItem>
            </TextField>
            <TextField label="Your feedback" value={message} onChange={(e) => setMessage(e.target.value)} multiline minRows={4} inputProps={{ maxLength: 2000 }} helperText={`${message.length}/2000 · Don’t include passwords or sensitive personal information.`} autoFocus />
        </Stack></DialogContent>
        <DialogActions><Button onClick={close}>Close</Button><Button variant="contained" onClick={submit} disabled={saving || message.trim().length < 3}>{saving ? "Sending…" : "Send feedback"}</Button></DialogActions>
    </Dialog>;
}
