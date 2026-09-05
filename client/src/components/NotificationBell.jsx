import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { markRead, markAllRead, fetchNotifications, fetchUnreadCount } from "../store/slices/notificationsSlice.js";
import { timeAgo } from "../utils/timezone.js";

const TYPE_META = {
  reminder: { Icon: ReportProblemIcon, color: "#f59e0b" },
  budget: { Icon: ReportProblemIcon, color: "#ef4444" },
  ai: { Icon: AutoAwesomeIcon, color: "#A9A0F2" },
  system: { Icon: AutoAwesomeIcon, color: "#10b981" },
};

export default function NotificationBell() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { items, unread, loading } = useSelector((s) => s.notifications);
  const [anchor, setAnchor] = React.useState(null);

  const open = Boolean(anchor);
  const id = open ? "notification-popover" : undefined;

  React.useEffect(() => {
    const poll = () => {
      dispatch(fetchUnreadCount());
      if (document.visibilityState === "visible") dispatch(fetchNotifications());
    };
    poll();
    const timer = setInterval(poll, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        dispatch(fetchUnreadCount());
        dispatch(fetchNotifications());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [dispatch]);

  const handleOpen = (e) => {
    setAnchor(e.currentTarget);
    dispatch(fetchNotifications());
    dispatch(fetchUnreadCount());
  };

  const handleClose = () => setAnchor(null);

  const handleItemClick = (n) => {
    if (!n.read) dispatch(markRead(n.id));
    handleClose();
    if (n.link && n.link !== location.pathname) navigate(n.link);
  };

  const handleMarkAll = () => {
    dispatch(markAllRead());
  };

  return (
    <React.Fragment>
      <Tooltip title="Notifications">
        <IconButton
          aria-label="notifications"
          onClick={handleOpen}
          sx={{
            width: 40,
            height: 40,
            color: "var(--fm-text-secondary)",
            border: "1px solid var(--fm-border)",
            bgcolor: "var(--fm-surface)",
            backdropFilter: "blur(8px)",
            transition: "all 0.15s ease",
            "&:hover": { bgcolor: "var(--fm-bg-hover)", color: "var(--fm-text-primary)" },
          }}
        >
          <Badge
            badgeContent={unread}
            color="error"
            invisible={!unread}
            max={99}
            sx={{
              "& .MuiBadge-badge": {
                fontSize: 10,
                minWidth: 16,
                height: 16,
                fontWeight: 700,
                border: "2px solid var(--fm-bg)",
              },
            }}
          >
            <NotificationsNoneIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        id={id}
        open={open}
        anchorEl={anchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              maxHeight: "calc(100vh - 80px)",
              borderRadius: "var(--fm-radius-lg, 14px)",
              border: "1px solid var(--fm-border)",
              bgcolor: "var(--fm-surface)",
              boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
              overflow: "hidden",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 80px)" }}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--fm-border)",
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: "var(--fm-text-primary)" }}>
            Notifications
            {unread > 0 && (
              <Box component="span" sx={{ color: "var(--fm-text-secondary)", fontWeight: 500, ml: 1, fontSize: 12 }}>
                · {unread} unread
              </Box>
            )}
          </Typography>
          {unread > 0 && (
            <Button
              size="small"
              onClick={handleMarkAll}
              sx={{ fontSize: 12, textTransform: "none", color: "var(--fm-brand, #5B4BD4)", minWidth: 0, p: 0.5 }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        <Box sx={{ overflowY: "auto", flex: 1, minHeight: 0, py: 0.5 }}>
          {loading && items.length === 0 && (
            <Box sx={{ p: 3, textAlign: "center", color: "var(--fm-text-secondary)", fontSize: 13 }}>
              Loading…
            </Box>
          )}
          {!loading && items.length === 0 && (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <NotificationsNoneIcon sx={{ fontSize: 34, color: "var(--fm-text-disabled, rgba(0,0,0,0.2))", mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: "var(--fm-text-secondary)" }}>No notifications yet</Typography>
            </Box>
          )}
          {items.map((n) => {
            const { Icon, color } = TYPE_META[n.type] || TYPE_META.system;
            return (
              <Box
                key={n.id}
                onClick={() => handleItemClick(n)}
                sx={{
                  display: "flex",
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  cursor: "pointer",
                  transition: "background 0.12s ease",
                  bgcolor: n.read ? "transparent" : "rgba(91,75,212,0.08)",
                  "&:hover": { bgcolor: "var(--fm-bg-hover)" },
                  borderBottom: "1px solid var(--fm-border)",
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: "9px",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: `${color}1a`,
                    color,
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: "var(--fm-text-primary)", lineHeight: 1.3 }}>
                    {n.title}
                  </Typography>
                  {n.message && (
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: "var(--fm-text-secondary)",
                        mt: 0.25,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {n.message}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 11, color: "var(--fm-text-disabled, rgba(0,0,0,0.35))", mt: 0.4 }}>
                    {timeAgo(n.created_at)}
                  </Typography>
                </Box>
                {!n.read && (
                  <CheckCircleOutlineIcon sx={{ fontSize: 14, color: "var(--fm-brand, #5B4BD4)", alignSelf: "center", opacity: 0.7 }} />
                )}
              </Box>
            );
          })}
        </Box>

        <Divider />
        <Box sx={{ p: 1, display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="small"
            onClick={() => { handleClose(); navigate("/reminders"); }}
            sx={{ fontSize: 12, textTransform: "none", color: "var(--fm-text-secondary)" }}
          >
            View all reminders
          </Button>
        </Box>
        </Box>
      </Popover>
    </React.Fragment>
  );
}
