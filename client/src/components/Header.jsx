import { useContext, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { AuthContext } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";

import {
    AppBar,
    Box,
    Button,
    IconButton,
    Menu,
    MenuItem,
    Stack,
    Toolbar,
    Tooltip,
    Typography,
} from "@mui/material";

import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import MenuIcon from "@mui/icons-material/Menu";

export default function Header() {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const { mode, toggle } = useThemeMode();
    // removed modal state for resume review page

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const handleOpenMenu = (event) => {
        setMenuAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchorEl(null);
    };

    return (
        <>
            {user ? (
                <>
                <AppBar position="static" color="primary" elevation={3}>
                    <Toolbar
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                        }}
                    >
                        {/* Logo / Brand */}
                        <Typography
                            variant="h6"
                            component={RouterLink}
                            to={user ? "/dashboard" : "/login"}
                            sx={{
                                textDecoration: "none",
                                color: "inherit",
                                fontWeight: "bold",
                            }}
                        >
                            CompanionAI
                        </Typography>

                        {/* Navigation links */}
                        <Box sx={{ display: { xs: "none", md: "block" } }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Button component={RouterLink} to="/dashboard" color="inherit">
                                    Dashboard
                                </Button>
                                <Button component={RouterLink} to="/experiences" color="inherit">
                                    Experiences
                                </Button>
                                <Button component={RouterLink} to="/create-interview" color="inherit">
                                    Create Interview
                                </Button>
                                <Button component={RouterLink} to="/resume-review" color="inherit">Resume Review</Button>
                                <Button component={RouterLink} to="/profile" color="inherit">
                                    Profile
                                </Button>
                                <Tooltip title={mode === "dark" ? "Switch to light" : "Switch to dark"}>
                                    <IconButton color="inherit" onClick={toggle} aria-label="toggle theme">
                                        {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
                                    </IconButton>
                                </Tooltip>
                                <Button variant="contained" color="error" onClick={handleLogout} size="small">
                                    Logout
                                </Button>
                            </Stack>
                        </Box>

                        {/* Mobile menu */}
                        <Box sx={{ display: { xs: "flex", md: "none" } }}>
                            <IconButton color="inherit" onClick={handleOpenMenu} aria-label="open navigation menu">
                                <MenuIcon />
                            </IconButton>
                            <Menu
                                anchorEl={menuAnchorEl}
                                open={Boolean(menuAnchorEl)}
                                onClose={handleCloseMenu}
                                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                transformOrigin={{ vertical: "top", horizontal: "right" }}
                            >
                                <MenuItem component={RouterLink} to="/dashboard" onClick={handleCloseMenu}>Dashboard</MenuItem>
                                <MenuItem component={RouterLink} to="/experiences" onClick={handleCloseMenu}>Experiences</MenuItem>
                                <MenuItem component={RouterLink} to="/create-interview" onClick={handleCloseMenu}>Create Interview</MenuItem>
                                <MenuItem component={RouterLink} to="/resume-review" onClick={handleCloseMenu}>Resume Review</MenuItem>
                                <MenuItem component={RouterLink} to="/profile" onClick={handleCloseMenu}>Profile</MenuItem>
                                <MenuItem onClick={() => { toggle(); handleCloseMenu(); }}>
                                    {mode === "dark" ? "Light Mode" : "Dark Mode"}
                                </MenuItem>
                                <MenuItem
                                    onClick={() => {
                                        handleCloseMenu();
                                        handleLogout();
                                    }}
                                >
                                    Logout
                                </MenuItem>
                            </Menu>
                        </Box>
                    </Toolbar>
                </AppBar>
                {/* Resume Review now a dedicated page; modal removed */}
                </>
            ) : (
                <></>
            )}
        </>
    );
}
