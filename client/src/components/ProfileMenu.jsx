import React from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ListItemIcon from "@mui/material/ListItemIcon";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import { logout } from "../store/slices/authSlice.js";

export default function ProfileMenu() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { username } = useSelector((s) => s.auth);
  const [anchor, setAnchor] = React.useState(null);
  const open = Boolean(anchor);

  const handleLogout = () => {
    setAnchor(null);
    dispatch(logout());
  };

  return (
    <React.Fragment>
      <Tooltip title="Account">
        <Box>
          <Avatar
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-label="account"
            sx={{
              width: 34,
              height: 34,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              bgcolor: "rgba(196,190,247,0.65)",
              color: "#5B4BD4",
              border: "1px solid var(--fm-border)",
              transition: "all 0.15s ease",
              "&:hover": { borderColor: "#5B4BD4" },
            }}
          >
            {(username || "A").charAt(0).toUpperCase()}
          </Avatar>
        </Box>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 220,
              mt: 1,
              borderRadius: "var(--fm-radius-lg, 12px)",
              border: "1px solid var(--fm-border)",
              bgcolor: "var(--fm-surface)",
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "var(--fm-text-primary)" }}>
            {username || "Account"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "var(--fm-text-secondary)" }}>
            Signed in
          </Typography>
        </Box>
        <Divider sx={{ borderColor: "var(--fm-border)" }} />
        <MenuItem
          onClick={() => { setAnchor(null); navigate("/settings"); }}
          sx={{ fontSize: 13, py: 1 }}
        >
          <ListItemIcon>
            <SettingsOutlinedIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          Account settings
        </MenuItem>
        <MenuItem onClick={handleLogout} sx={{ fontSize: 13, py: 1, color: "#ef4444" }}>
          <ListItemIcon>
            <LogoutIcon sx={{ fontSize: 18, color: "#ef4444" }} />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>
    </React.Fragment>
  );
}
