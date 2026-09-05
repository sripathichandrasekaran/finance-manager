import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Fade from "@mui/material/Fade";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import SendIcon from "@mui/icons-material/Send";
import AddIcon from "@mui/icons-material/Add";
import HistoryIcon from "@mui/icons-material/History";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import NotificationImportantIcon from "@mui/icons-material/NotificationImportant";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SubscriptionsIcon from "@mui/icons-material/Subscriptions";
import GroupsIcon from "@mui/icons-material/Groups";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EventNoteIcon from "@mui/icons-material/EventNote";
import PieChartIcon from "@mui/icons-material/PieChart";

import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import api from "../services/api.js";

// ---------------------------------------------------------------- markdown ---
function renderInline(text) {
  const parts = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Box key={key++} component="span" sx={{ fontWeight: 700, color: "inherit" }}>
        {m[1]}
      </Box>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

function Markdown({ text }) {
  const lines = text.split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      const level = line.match(/^(#+)\s/)[1].length;
      const content = line.replace(/^#+\s/, "");
      blocks.push(
        <Typography
          key={blocks.length}
          sx={{ fontWeight: 700, fontSize: level === 1 ? "16px" : "14px", mt: 1, mb: 0.5 }}
        >
          {renderInline(content)}
        </Typography>
      );
      i++;
    } else if (/^[-*•]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        items.push(
          <Box key={i} component="li" sx={{ mb: 0.25 }}>
            {renderInline(lines[i].replace(/^[-*•]\s/, "").trim())}
          </Box>
        );
        i++;
      }
      blocks.push(
        <Box key={blocks.length} component="ul" sx={{ m: 0, pl: 2.25, my: 0.5 }}>
          {items}
        </Box>
      );
    } else {
      const para = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !/^#{1,4}\s/.test(lines[i]) && !/^[-*•]\s/.test(lines[i].trim())) {
        para.push(lines[i].trim());
        i++;
      }
      blocks.push(
        <Typography key={blocks.length} variant="body2" sx={{ mt: 0.75 }}>
          {renderInline(para.join(" "))}
        </Typography>
      );
    }
  }
  return <div>{blocks}</div>;
}

// ------------------------------------------------------------------- config --
const SUGGESTIONS = [
  "How much did I spend this month?",
  "Add ₹150 coffee to Food",
  "What subscriptions are coming up?",
  "Show my recent transactions",
  "Set a budget of ₹5000 for Food",
  "Remind me to pay rent on the 1st",
];

const MODULE_LINKS = [
  { to: "/transactions", label: "Transactions", icon: <ReceiptLongIcon /> },
  { to: "/subscriptions", label: "Subscriptions", icon: <SubscriptionsIcon /> },
  { to: "/companies", label: "Companies", icon: <GroupsIcon /> },
  { to: "/budget", label: "Budget", icon: <PieChartIcon /> },
  { to: "/time", label: "Time", icon: <AccessTimeIcon /> },
  { to: "/reminders", label: "Reminders", icon: <EventNoteIcon /> },
];

const TOOL_LABELS = {
  create_transaction: "Added transaction",
  update_transaction: "Updated transaction",
  delete_transaction: "Deleted transaction",
  list_transactions: "Listed transactions",
  transaction_summary: "Pulled summary",
  create_subscription: "Added subscription",
  update_subscription: "Updated subscription",
  delete_subscription: "Deleted subscription",
  list_subscriptions: "Listed subscriptions",
  create_company: "Added company",
  update_company: "Updated company",
  delete_company: "Deleted company",
  list_companies: "Listed companies",
  create_budget: "Added budget",
  update_budget: "Updated budget",
  delete_budget: "Deleted budget",
  list_budgets: "Listed budgets",
  create_time_entry: "Logged time",
  update_time_entry: "Updated time entry",
  delete_time_entry: "Deleted time entry",
  list_time_entries: "Listed time entries",
  list_reminders: "Listed reminders",
  create_reminder: "Added reminder",
  set_reminder_status: "Updated reminder",
  get_today: "Resolved date",
};

const STORAGE_KEY = "fm_ai_sessions";
const ACTIVE_KEY = "fm_ai_active_id";
const MAX_SESSIONS = 20;

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AIAssistant() {
  const [aiStatus, setAiStatus] = useState({ loading: true, configured: false });
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [historyAnchor, setHistoryAnchor] = useState(null);
  const [sessionMenu, setSessionMenu] = useState(null);
  const scrollRef = useRef(null);
  const readyRef = useRef(false);
  const lastSavedRef = useRef({});
  const saveTimerRef = useRef(null);

  // ---- load: DB is the source of truth, localStorage is the fast cache ----
  useEffect(() => {
    let localSessions = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      localSessions = raw ? JSON.parse(raw) : [];
    } catch {
      /* ignore corrupt storage */
    }

    api
      .get("/ai/sessions")
      .then(({ data }) => {
        // Merge remote + local by id, preferring the server copy.
        for (const s of data) lastSavedRef.current[s.id] = JSON.stringify(s.messages || []);
        const merged = Array.from(
          new Map(
            [...data, ...localSessions].map((s) => [s.id, s])
          ).values()
        );
        setSessions(merged.slice(0, MAX_SESSIONS));
        readyRef.current = true;

        // Restore the last active conversation; fall back to the most recent one.
        let lastId = null;
        try {
          lastId = localStorage.getItem(ACTIVE_KEY);
        } catch {
          /* ignore */
        }
        const target = merged.find((s) => s.id === lastId) || merged[0];
        if (target) setActiveId(target.id);
      })
      .catch(() => {
        // Backend unreachable — fall back to the local cache.
        setSessions(localSessions);
        readyRef.current = true;
        let lastId = null;
        try {
          lastId = localStorage.getItem(ACTIVE_KEY);
        } catch {
          /* ignore */
        }
        const target = localSessions.find((s) => s.id === lastId) || localSessions[0];
        if (target) setActiveId(target.id);
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
    } catch {
      /* quota exceeded — ignore */
    }
  }, [sessions]);

  // ---- save: mirror in-memory changes to the DB (debounced, only dirty ones) ----
  useEffect(() => {
    if (!readyRef.current || !aiStatus.configured) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      for (const s of sessions.slice(0, MAX_SESSIONS)) {
        const fp = JSON.stringify(s.messages || []);
        if (lastSavedRef.current[s.id] === fp) continue;
        api
          .post("/ai/sessions", { id: s.id, title: s.title ?? "New chat", messages: s.messages || [] })
          .then(() => {
            lastSavedRef.current[s.id] = fp;
          })
          .catch(() => {});
      }
    }, 600);
    return () => clearTimeout(saveTimerRef.current);
  }, [sessions, aiStatus.configured]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  }, [activeId]);

  const active = sessions.find((s) => s.id === activeId) || null;
  const messages = active?.messages || [];

  const newSession = () => {
    const id = uid();
    const now = new Date().toISOString();
    const session = { id, title: "New chat", messages: [], createdAt: now, updatedAt: now };
    setSessions((prev) => [session, ...prev].slice(0, MAX_SESSIONS));
    setActiveId(id);
    setError("");
  };

  // Start with a fresh session on mount.
  useEffect(() => {
    if (!aiStatus.loading && aiStatus.configured && sessions.length === 0 && !activeId) {
      newSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiStatus.loading, aiStatus.configured]);

  // ---- data ----
  useEffect(() => {
    api
      .get("/ai/status")
      .then(({ data }) => setAiStatus({ loading: false, ...data }))
      .catch(() => setAiStatus({ loading: false, configured: false }));
  }, []);

  useEffect(() => {
    if (!aiStatus.loading && aiStatus.configured) {
      api
        .get("/dashboard/stats")
        .then(({ data }) => setStats(data))
        .catch(() => setStats(null))
        .finally(() => setStatsLoading(false));
    }
  }, [aiStatus]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, busy]);

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setError("");

    // Target the active session, or start a fresh one if none is active.
    let targetId = activeId;
    if (!targetId) {
      targetId = uid();
      setActiveId(targetId);
    }

    const existing = sessions.find((s) => s.id === targetId);
    const history = (existing ? existing.messages : [])
      .filter((m) => m.role === "assistant" || m.role === "user")
      .map((m) => ({ role: m.role, content: m.content }));

    // Append the user message (and create the session if it's brand new).
    setSessions((prev) => {
      const now = new Date().toISOString();
      if (prev.some((s) => s.id === targetId)) {
        return prev.map((s) =>
          s.id === targetId
            ? { ...s, messages: [...s.messages, { id: uid(), role: "user", content: text, createdAt: now }], updatedAt: now }
            : s
        );
      }
      return [
        { id: targetId, title: truncate(text), messages: [{ id: uid(), role: "user", content: text, createdAt: now }], createdAt: now, updatedAt: now },
        ...prev,
      ].slice(0, MAX_SESSIONS);
    });
    setBusy(true);

    try {
      const { data } = await api.post("/ai/agent-chat", { message: text, history });
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetId
            ? {
                ...s,
                title: s.title === "New chat" ? truncate(text) : s.title,
                messages: [
                  ...s.messages,
                  { id: uid(), role: "assistant", content: data.reply, actions: data.actions || [], createdAt: new Date().toISOString() },
                ],
                updatedAt: new Date().toISOString(),
              }
            : s
        )
      );
    } catch (err) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: uid(),
                    role: "assistant",
                    content: err.response?.data?.detail || "Sorry, something went wrong reaching the assistant.",
                    error: true,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : s
        )
      );
      setError(err.response?.data?.detail || "Could not reach the AI agent.");
    } finally {
      setBusy(false);
    }
  };

  const selectSession = (id) => {
    setActiveId(id);
    setError("");
    setHistoryAnchor(null);
  };

  const deleteSession = (id) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === activeId) setActiveId(null);
    setSessionMenu(null);
    api.delete(`/ai/sessions/${encodeURIComponent(id)}`).catch(() => {});
  };

  const clearAll = () => {
    const ids = sessions.map((s) => s.id);
    setSessions([]);
    setActiveId(null);
    setError("");
    setSessionMenu(null);
    ids.forEach((id) => api.delete(`/ai/sessions/${encodeURIComponent(id)}`).catch(() => {}));
  };

  if (aiStatus.loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!aiStatus.configured) {
    return (
      <Box>
        <PageHeader title="AI Assistant" description="Set your Anthropic API key to enable" />
        <Alert severity="info">
          The AI assistant is not configured. Add <code>ANTHROPIC_API_KEY</code> to your <code>.env</code> file and
          restart the backend to enable natural-language chat.
        </Alert>
      </Box>
    );
  }

  const firstUserMsg = (msgs) => msgs.find((m) => m.role === "user")?.content || "Untitled";
  const isWelcome = messages.length === 0;
  const balanceColor = (stats?.month_balance ?? 0) >= 0 ? "var(--fm-success)" : "var(--fm-danger)";

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="AI Assistant"
        description="Chat in plain English — the agent detects what you need and manages your finance modules for you"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={newSession}>
            New chat
          </Button>
        }
      />

      {/* ---- Stats strip ---- */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="overline" sx={{ display: "block", mb: 1, color: "var(--fm-text-subtle)", letterSpacing: "0.08em", fontSize: "11px" }}>
          This month at a glance
        </Typography>
        <Grid container spacing={1.5}>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard title="Month Balance" value={stats?.month_balance} color={balanceColor} icon={<AccountBalanceWalletIcon />} loading={statsLoading} sub={stats?.period} />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard title="Month Spent" value={stats?.month_debit} color="var(--fm-danger)" icon={<TrendingDownIcon />} loading={statsLoading} />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard title="Subscriptions / Month" value={stats?.subscription_monthly_total} color="var(--fm-text-primary)" icon={<AutorenewIcon />} loading={statsLoading} />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              title="Upcoming Bills"
              value={stats?.upcoming_count}
              currency={false}
              color="var(--fm-text-primary)"
              icon={<NotificationImportantIcon />}
              loading={statsLoading}
              sub={stats?.pending_reminders ? `${stats.pending_reminders} reminder(s) due today` : "next 30 days"}
            />
          </Grid>
        </Grid>
      </Box>

      {/* ---- Module quick links ---- */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        {MODULE_LINKS.map((m) => (
          <Link key={m.to} to={m.to} style={{ textDecoration: "none" }}>
            <Chip
              icon={<Box sx={{ display: "flex", "& .MuiSvgIcon-root": { fontSize: 15 } }}>{m.icon}</Box>}
              label={m.label}
              clickable
              sx={{
                bgcolor: "var(--fm-bg-soft)",
                border: "1px solid var(--fm-card-border)",
                "&:hover": { bgcolor: "var(--fm-bg-hover)", borderColor: "var(--fm-primary-tint)" },
                transition: "background-color .18s, border-color .18s",
              }}
            />
          </Link>
        ))}
      </Box>

      {/* ---- Chat panel ---- */}
      <Paper
        variant="outlined"
        elevation={0}
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "min(72vh, 680px)",
          minHeight: 460,
          overflow: "hidden",
          borderRadius: "var(--fm-radius-xl)",
          bgcolor: "var(--fm-surface)",
          borderColor: "var(--fm-card-border)",
        }}
      >
        {/* toolbar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1.25,
            borderBottom: "1px solid var(--fm-card-border)",
            bgcolor: "var(--fm-bg-soft)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flex: 1, minWidth: 0 }}>
            <AutoAwesomeIcon sx={{ color: "var(--fm-primary)", fontSize: 20 }} />
            <Typography sx={{ fontWeight: 650, fontSize: "14px" }}>Assistant</Typography>
            <Tooltip title="Conversation history">
              <IconButton size="small" onClick={(e) => setHistoryAnchor(e.currentTarget)} sx={{ ml: 0.5 }}>
                <HistoryIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Typography variant="caption" sx={{ color: "var(--fm-text-subtle)", ml: 0.5, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {active ? firstUserMsg(active.messages) : ""}
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ m: 2, mb: 0 }}>
            {error}
          </Alert>
        )}

        {/* messages */}
        <Box
          ref={scrollRef}
          sx={{ flex: 1, overflowY: "auto", p: 2.5, display: "flex", flexDirection: "column", gap: 1.5, bgcolor: "var(--fm-bg)" }}
        >
          {isWelcome ? (
            <Box sx={{ textAlign: "center", my: "auto", px: 2 }}>
              <Box
                sx={{
                  width: 60, height: 60, mx: "auto", borderRadius: "20px", display: "grid", placeItems: "center",
                  background: "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))",
                  color: "#fff", boxShadow: "0 10px 24px var(--fm-primary-a30)", mb: 2,
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 30 }} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: "20px" }}>What would you like to do?</Typography>
              <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", mt: 0.5, maxWidth: 460, mx: "auto" }}>
                I can add, update, delete, or pull data across transactions, subscriptions, companies, budgets,
                time tracking, and reminders.
              </Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center", mt: 2.5, maxWidth: 720, mx: "auto" }}>
                {SUGGESTIONS.map((s, i) => (
                  <Chip
                    key={s}
                    label={s}
                    clickable
                    size="small"
                    onClick={() => send(s)}
                    sx={{ bgcolor: "var(--fm-bg-soft)", border: "1px solid var(--fm-card-border)", transition: "all .18s", "&:hover": { borderColor: "var(--fm-primary-tint)", bgcolor: "var(--fm-bg-hover)", transform: "translateY(-1px)" }, animation: `fmFadeUp .4s ${i * 60}ms both` }}
                  />
                ))}
              </Box>
            </Box>
          ) : (
            messages.map((msg, idx) => <Bubble key={msg.id} msg={msg} delay={idx} />)
          )}
          {busy && <TypingIndicator />}
        </Box>

        {/* input */}
        <Box sx={{ p: 2, borderTop: "1px solid var(--fm-card-border)", bgcolor: "var(--fm-surface)" }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
            <TextField
              fullWidth
              size="small"
              multiline
              maxRows={4}
              placeholder='Try "how much did I spend on Food this month?"'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "var(--fm-radius-lg)",
                  bgcolor: "var(--fm-bg-soft)",
                  "& fieldset": { borderColor: "var(--fm-card-border)" },
                  "&:hover fieldset": { borderColor: "var(--fm-primary-tint)" },
                  "&.Mui-focused fieldset": { borderColor: "var(--fm-primary)" },
                },
              }}
            />
            <IconButton
              onClick={() => send()}
              disabled={busy || !input.trim()}
              sx={{
                width: 44, height: 44, borderRadius: "var(--fm-radius-md)",
                background: "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))",
                color: "#fff",
                "&:hover": { background: "linear-gradient(135deg, var(--fm-primary-hover), var(--fm-primary))" },
                "&.Mui-disabled": { bgcolor: "var(--fm-bg-hover)", color: "var(--fm-text-faint)", background: "none" },
                transition: "background .2s, transform .1s",
                "&:active:not(.Mui-disabled)": { transform: "scale(0.94)" },
              }}
            >
              {busy ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Typography variant="caption" sx={{ display: "block", mt: 1, color: "var(--fm-text-subtle)" }}>
            Powered by Claude — the agent performs the actions for you (all amounts in ₹).
          </Typography>
        </Box>
      </Paper>

      {/* conversation history popover */}
      <Menu
        anchorEl={historyAnchor}
        open={Boolean(historyAnchor)}
        onClose={() => setHistoryAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{ sx: { width: 300, maxHeight: 420, borderRadius: "var(--fm-radius-lg)", mt: 1 } }}
      >
        <Box sx={{ px: 2, py: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontWeight: 650, fontSize: "13px" }}>Conversation history</Typography>
          <Button size="small" onClick={clearAll} sx={{ color: "var(--fm-danger)", fontSize: "12px" }}>
            Clear all
          </Button>
        </Box>
        {sessions.length === 0 ? (
          <Typography variant="body2" sx={{ px: 2, py: 3, textAlign: "center", color: "var(--fm-text-subtle)" }}>
            No conversations yet.
          </Typography>
        ) : (
          sessions.map((s) => (
            <MenuItem key={s.id} selected={s.id === activeId} onClick={() => selectSession(s.id)} sx={{ py: 1, flexDirection: "column", alignItems: "stretch" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <Typography sx={{ fontSize: "13px", fontWeight: activeId === s.id ? 650 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                  {s.title || s.messages.find((m) => m.role === "user")?.content || "New chat"}
                </Typography>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSessionMenu({ anchor: e.currentTarget, id: s.id }); }} sx={{ p: 0.25 }}>
                  <MoreVertIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              <Typography variant="caption" sx={{ color: "var(--fm-text-subtle)", fontSize: "11px" }}>
                {s.messages.length} message(s) • {new Date(s.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
              </Typography>
            </MenuItem>
          ))
        )}
      </Menu>

      <Menu
        anchorEl={sessionMenu?.anchor}
        open={Boolean(sessionMenu)}
        onClose={() => setSessionMenu(null)}
      >
        <MenuItem onClick={() => sessionMenu && deleteSession(sessionMenu.id)}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
          Delete conversation
        </MenuItem>
      </Menu>

      <style>{`
        @keyframes fmFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fmBlink { 0%,80%,100% { opacity:.25 } 40% { opacity:1 } }
      `}</style>
    </Box>
  );
}

function truncate(text) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}

function Bubble({ msg, delay }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";

  if (isUser) {
    return (
      <Fade in timeout={150}>
        <Box sx={{ display: "flex", gap: 1, flexDirection: "row-reverse", alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 30, height: 30, flex: "0 0 auto", borderRadius: "10px",
              display: "grid", placeItems: "center",
              bgcolor: "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))",
              background: "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))",
              color: "#fff", boxShadow: "0 4px 10px var(--fm-primary-a30)", mt: 0.5,
            }}
          >
            <PersonOutlineIcon sx={{ fontSize: 17 }} />
          </Box>
          <Box sx={{ maxWidth: "min(78%, 560px)" }}>
            <Box
              sx={{
                px: 2, py: 1.25,
                borderRadius: "var(--fm-radius-lg)",
                borderTopRightRadius: 4,
                background: "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))",
                color: "#fff",
                fontSize: "14px",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                boxShadow: "0 4px 14px var(--fm-primary-a30)",
              }}
            >
              {msg.content}
            </Box>
            <Typography variant="caption" sx={{ display: "block", textAlign: "right", mt: 0.25, color: "var(--fm-text-faint)" }}>
              {time}
            </Typography>
          </Box>
        </Box>
      </Fade>
    );
  }

  return (
    <Fade in timeout={150}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 30, height: 30, flex: "0 0 auto", borderRadius: "10px",
              display: "grid", placeItems: "center",
              background: "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))",
              color: "#fff", opacity: 0.9, boxShadow: "0 4px 10px var(--fm-primary-a30)", mt: 0.5,
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 16 }} />
          </Box>
          <Box sx={{ maxWidth: "min(82%, 640px)" }}>
            <Box
              sx={{
                px: 2, py: 1.4,
                borderRadius: "var(--fm-radius-lg)",
                borderTopLeftRadius: 4,
                bgcolor: "var(--fm-surface)",
                border: "1px solid var(--fm-card-border)",
                color: "var(--fm-text-primary)",
                fontSize: "14px",
                lineHeight: 1.55,
                boxShadow: "var(--fm-shadow), 0 8px 24px var(--fm-shadow-soft)",
              }}
            >
              <Markdown text={msg.content} />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25, pl: 0.5 }}>
              <Typography variant="caption" sx={{ color: "var(--fm-text-faint)" }}>
                {time}
              </Typography>
              <Tooltip title={copied ? "Copied" : "Copy reply"}>
                <IconButton size="small" onClick={copy} sx={{ p: 0.25, color: "var(--fm-text-subtle)", "&:hover": { color: "var(--fm-primary)" } }}>
                  {copied ? <CheckIcon sx={{ fontSize: 13 }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
        {msg.actions && msg.actions.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5, pl: 5.5, mb: 0.5 }}>
            {msg.actions.map((a, idx) => (
              <Tooltip key={idx} title={a.result?.error ? `Error: ${a.result.error}` : `args: ${JSON.stringify(a.args)}`}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={TOOL_LABELS[a.tool] || a.tool}
                  sx={{ height: 22, fontSize: "11px", borderColor: "var(--fm-primary-tint)", color: "var(--fm-text-soft)", "& .MuiChip-label": { px: 1 } }}
                />
              </Tooltip>
            ))}
          </Box>
        )}
        {msg.error && (
          <Typography variant="caption" sx={{ color: "var(--fm-danger)", mt: 0.5, ml: 5.5, display: "block" }}>
            Action failed
          </Typography>
        )}
      </Box>
    </Fade>
  );
}

function TypingIndicator() {
  return (
    <Fade in timeout={150}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 30, height: 30, flex: "0 0 auto", borderRadius: "10px",
            display: "grid", placeItems: "center",
            background: "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))",
            color: "#fff", opacity: 0.9, boxShadow: "0 4px 10px var(--fm-primary-a30)", mt: 0.5,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 16 }} />
        </Box>
        <Box
          sx={{
            display: "flex", gap: 0.75, alignItems: "center",
            px: 2, py: 1.4, borderRadius: "var(--fm-radius-lg)", borderTopLeftRadius: 4,
            bgcolor: "var(--fm-surface)", border: "1px solid var(--fm-card-border)", boxShadow: "var(--fm-shadow)",
          }}
        >
          {[0, 1, 2].map((d) => (
            <Box key={d} sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "var(--fm-text-subtle)", animation: "fmBlink 1.2s infinite", animationDelay: `${d * 0.2}s` }} />
          ))}
        </Box>
      </Box>
    </Fade>
  );
}
