import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import { AuthContext } from "../context/AuthContext";

import { Box, Button, Card, CardActionArea, CardContent, CircularProgress, Pagination, Stack, Typography, ToggleButton, ToggleButtonGroup, Chip } from "@mui/material";

const DashboardPage = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState("all"); // all | completed | in_progress

    useEffect(() => {
        const fetchInterviews = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/interviews`, { params: { page, limit } });
                if (Array.isArray(data)) {
                    setInterviews(data);
                    setTotalPages(1);
                } else {
                    setInterviews(Array.isArray(data?.items) ? data.items : []);
                    setTotalPages(Number(data?.totalPages) || 1);
                }
            } catch (err) {
                console.error(err);
                setInterviews([]);
                setTotalPages(1);
            } finally {
                setLoading(false);
            }
        };
        if (user?._id) fetchInterviews();
    }, [user, page, limit]);

    return (
        <div style={{ padding: "2rem" }}>
            <Typography variant="h5" gutterBottom>
                My Interviews
            </Typography>

            {loading ? (
                <CircularProgress />
            ) : interviews.length === 0 ? (
                <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">You haven't started any interviews yet.</Typography>
                    <Button variant="contained" onClick={() => navigate("/create-interview")}>
                        Start your first interview
                    </Button>
                </Stack>
            ) : (
                <Stack spacing={2}>
                    <ToggleButtonGroup
                        value={statusFilter}
                        exclusive
                        onChange={(_, v) => setStatusFilter(v || "all")}
                        size="small"
                        color="primary"
                    >
                        <ToggleButton value="all">All</ToggleButton>
                        <ToggleButton value="in_progress">In Progress</ToggleButton>
                        <ToggleButton value="completed">Completed</ToggleButton>
                    </ToggleButtonGroup>

                    {(() => {
                        const filtered = interviews.filter((it) => {
                            if (statusFilter === "all") return true;
                            const isCompleted = Boolean(it.isCompleted);
                            return statusFilter === "completed" ? isCompleted : !isCompleted;
                        });
                        if (filtered.length === 0) {
                            return (
                                <Typography color="text.secondary" sx={{ py: 2 }}>
                                    No {statusFilter === "completed" ? "completed" : "in-progress"} interviews yet.
                                </Typography>
                            );
                        }
                        return filtered.map((interview) => (
                        <Card
                            key={interview._id}
                            variant="outlined"
                            sx={{
                                borderColor: interview.isCompleted ? "success.main" : "warning.main",
                                borderWidth: 2,
                            }}
                        >
                            <CardActionArea onClick={() => navigate(`/interviews/${interview._id}`)}>
                            <CardContent>
                                <Typography variant="h6">{interview.company}</Typography>
                                <Typography variant="body2">{interview.jobRole}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {new Date(interview.createdAt).toLocaleDateString()}
                                </Typography>
                                <Stack direction="row" spacing={1} mt={1} alignItems="center">
                                    <Chip size="small" label={interview.isCompleted ? "Completed" : "In Progress"} color={interview.isCompleted ? "success" : "warning"} />
                                    {Number.isFinite(Number(interview.roundsCompleted)) && Number.isFinite(Number(interview.roundsTotal)) && (
                                        <Typography variant="caption" color="text.secondary">
                                            Rounds: {interview.roundsCompleted}/{interview.roundsTotal}
                                        </Typography>
                                    )}
                                </Stack>
                            </CardContent>
                            </CardActionArea>
                        </Card>
                        ));
                    })()}
                </Stack>
            )}

            {totalPages > 1 && (
                <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
                    <Pagination color="primary" page={page} count={totalPages} onChange={(_, p) => setPage(p)} />
                </Box>
            )}
        </div>
    );
};

export default DashboardPage;
