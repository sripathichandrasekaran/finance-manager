import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import MenuIcon from "@mui/icons-material/Menu";
import Divider from "@mui/material/Divider";
import { NAV_ITEMS } from "../constants/navigation.js";
import { useThemeMode } from "../theme/ThemeModeContext.jsx";
import NotificationBell from "./NotificationBell.jsx";
import ProfileMenu from "./ProfileMenu.jsx";
import FloatingAIChat from "./FloatingAIChat.jsx";
import { useRealtimeNotifications } from "../services/realtime.js";

const SIDEBAR_WIDTH = 260;
const MOBILE_DRAWER_WIDTH = 250;

const NAV_GROUPS = [
  {
    title: "Overview",
    ids: ["dashboard", "companies", "projects", "invoices", "profit", "transactions", "subscriptions"],
  },
  {
    title: "Freelancer Tools",
    ids: ["time", "budget", "reports"],
  },
  {
    title: "Assistant",
    ids: ["ai", "reminders"],
  },
];

const StyledNavLink = styled(NavLink)(() => ({
  textDecoration: "none",
  display: "block",
  "& .MuiListItemButton-root": {
    height: 36,
    minHeight: 36,
    borderRadius: 6,
    marginBottom: 2,
    padding: "0 12px",
    color: "rgba(255,255,255,0.55)",
    transition: "all 0.15s ease",
    position: "relative",
    "&:hover": {
      backgroundColor: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.9)",
      "& .MuiListItemIcon-root": { color: "rgba(255,255,255,0.7)" },
    },
    "& .MuiListItemIcon-root": {
      color: "rgba(255,255,255,0.35)",
      minWidth: 30,
    },
    "& .MuiSvgIcon-root": { fontSize: 18 },
  },
  "&.active .MuiListItemButton-root": {
    backgroundColor: "rgba(196,190,247,0.16)",
    color: "#FFFFFF",
    "& .MuiListItemIcon-root": { color: "#A9A0F2" },
    "& .MuiListItemText-primary": { fontWeight: 600 },
    "&::after": {
      content: '""',
      position: "absolute",
      left: 0,
      top: "50%",
      transform: "translateY(-50%)",
      width: 3,
      height: 16,
      borderRadius: "0 3px 3px 0",
      backgroundColor: "#A9A0F2",
    },
  },
}));

function NavGroup({ title, ids, onNavigate }) {
  const items = NAV_ITEMS.filter((it) => ids.includes(it.id));
  return (
    <Box sx={{ mb: 0.5 }}>
      <Typography
        sx={{
          px: 2,
          mb: 0.75,
          mt: 2,
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.3)",
        }}
      >
        {title}
      </Typography>
      <List disablePadding sx={{ px: 1 }}>
        {items.map(({ id, label, Icon, path }) => (
          <StyledNavLink key={id} to={path} end={path === "/"} onClick={onNavigate}>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon>
                  <Icon />
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  sx={{
                    "& .MuiListItemText-primary": {
                      fontSize: "13px",
                      fontWeight: 500,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          </StyledNavLink>
        ))}
      </List>
    </Box>
  );
}

function ThemeToggle() {
  const { isDark, toggleTheme } = useThemeMode();
  return (
    <Tooltip title={isDark ? "Switch to light" : "Switch to dark"}>
      <IconButton
        onClick={toggleTheme}
        aria-label="Toggle theme mode"
        size="small"
        sx={{
          color: "rgba(255,255,255,0.35)",
          width: 28,
          height: 28,
          "&:hover": { color: "rgba(255,255,255,0.8)", backgroundColor: "rgba(255,255,255,0.06)" },
        }}
      >
        {isDark ? <LightModeIcon sx={{ fontSize: 16 }} /> : <DarkModeIcon sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
}

function Brand() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: "8px",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, #5B4BD4 0%, #8D7BF0 100%)",
          color: "#FFFFFF",
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="14" width="4" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
          <rect x="10" y="9" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.7" />
          <rect x="17" y="3" width="4" height="18" rx="1.5" fill="currentColor" />
          <path d="M4.5 13L11.5 8L17.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
        </svg>
      </Box>
      <Box>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: "14px",
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            color: "#F8FAFC",
          }}
        >
          Finance
        </Typography>
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: "9px",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            mt: 0.15,
          }}
        >
          MANAGER
        </Typography>
      </Box>
    </Box>
  );
}

function SidebarContent({ onNavigate }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "var(--fm-sidebar-bg)" }}>
      <Box sx={{ px: 2, pt: 2.5, pb: 2 }}>
        <Brand />
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mx: 2 }} />
      <Box sx={{ overflowY: "auto", flex: 1, mt: 1, pb: 2 }}>
        {NAV_GROUPS.map((g) => (
          <NavGroup key={g.title} title={g.title} ids={g.ids} onNavigate={onNavigate} />
        ))}
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mx: 2 }} />
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography sx={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>
          v1.0.0
        </Typography>
        <ThemeToggle />
      </Box>
    </Box>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  useRealtimeNotifications();
  const location = useLocation();

  const closeMobile = () => setMobileOpen(false);

  const navItem = NAV_ITEMS.find((n) => n.path === location.pathname);
  const pageTitle = navItem ? navItem.label : "Account";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "var(--fm-bg)" }}>
      {/* Desktop sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: { md: SIDEBAR_WIDTH },
          flexShrink: 0,
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            boxSizing: "border-box",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "0 !important",
            backgroundColor: "var(--fm-sidebar-bg)",
            backgroundImage: "none",
            top: 0,
            height: "100vh",
          },
        }}
        open
      >
        <SidebarContent />
      </Drawer>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={closeMobile}
        ModalProps={{ keepMounted: true, sx: { zIndex: 1300 } }}
        PaperProps={{
          sx: {
            width: `${MOBILE_DRAWER_WIDTH}px !important`,
            minWidth: `${MOBILE_DRAWER_WIDTH}px !important`,
            maxWidth: `${MOBILE_DRAWER_WIDTH}px !important`,
            boxSizing: "border-box",
            borderRadius: "0 !important",
            borderTopLeftRadius: "0 !important",
            borderTopRightRadius: "0 !important",
            borderBottomLeftRadius: "0 !important",
            borderBottomRightRadius: "0 !important",
            height: "100vh !important",
            maxHeight: "100vh",
            left: 0,
            top: 0,
            backgroundColor: "var(--fm-sidebar-bg)",
            backgroundImage: "none",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "8px 0 24px rgba(0,0,0,0.18)",
          },
        }}
        BackdropProps={{
          sx: {
            backgroundColor: "rgba(10, 15, 25, 0.55)",
          },
        }}
      >
        <SidebarContent onNavigate={closeMobile} />
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: "var(--fm-bg)",
          width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
        }}
      >
        {/* Top navbar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: { xs: 2, sm: 3, md: 4 },
            py: 1.5,
            borderBottom: "1px solid var(--fm-border)",
            bgcolor: "var(--fm-surface)",
            position: "sticky",
            top: 0,
            zIndex: 1200,
          }}
        >
          <IconButton
            onClick={() => setMobileOpen(true)}
            aria-label="open menu"
            sx={{
              display: { md: "none" },
              color: "var(--fm-text-primary)",
              width: 36,
              height: 36,
              "&:hover": { bgcolor: "var(--fm-bg-hover)" },
            }}
          >
            <MenuIcon sx={{ fontSize: 22 }} />
          </IconButton>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: 16,
              color: "var(--fm-text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {pageTitle}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <NotificationBell />
          <ProfileMenu />
        </Box>

        <Box
          sx={{
            width: "100%",
            px: { xs: 2, sm: 3, md: 4 },
            py: { xs: 2.5, md: 3.5 },
          }}
        >
          {children}
        </Box>
      </Box>

      {/* Floating AI chatbot — hidden on the full AI Assistant page */}
      {location.pathname !== "/ai" && <FloatingAIChat />}
    </Box>
  );
}
