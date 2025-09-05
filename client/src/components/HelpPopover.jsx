import { IconButton, Popover, Stack, Typography, Divider, List, ListItem, ListItemText } from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useState, memo } from "react";

const HelpPopover = ({ placement = { vertical: "bottom", horizontal: "right" } }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const id = open ? "help-popover" : undefined;

    return (
        <>
            <IconButton
                aria-label="Open help"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ "&:focus-visible": { outline: "3px solid rgba(25,118,210,0.6)", outlineOffset: 2 } }}
            >
                <HelpOutlineIcon />
            </IconButton>
            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={placement}
            >
                <Stack spacing={1.5} sx={{ p: 2, maxWidth: 360 }}>
                    <Typography variant="h6">Quick help</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Tips and shortcuts to speed up your interview flow.
                    </Typography>
                    <Divider />
                    <Typography variant="subtitle2">Keyboard shortcuts</Typography>
                    <List dense disablePadding>
                        <ListItem>
                            <ListItemText primary="Cmd/Ctrl + Enter" secondary="Submit answer or round" />
                        </ListItem>
                        <ListItem>
                            <ListItemText primary="? (Shift+/)" secondary="Open this help" />
                        </ListItem>
                        <ListItem>
                            <ListItemText primary="Esc" secondary="Stop voice" />
                        </ListItem>
                    </List>
                    <Divider />
                    <Typography variant="subtitle2">Voice tips</Typography>
                    <List dense disablePadding>
                        <ListItem>
                            <ListItemText primary="Mic permissions" secondary="Grant access if prompted; choose your device." />
                        </ListItem>
                        <ListItem>
                            <ListItemText primary="Live level" secondary="Use the meter to confirm input." />
                        </ListItem>
                    </List>
                </Stack>
            </Popover>
        </>
    );
};

export default memo(HelpPopover);
