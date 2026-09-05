import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Fab from "@mui/material/Fab";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SendIcon from "@mui/icons-material/Send";
import api from "../services/api.js";

const STORAGE_KEY = "fm_ai_sessions";
const ACTIVE_KEY = "fm_ai_active_id";
const MAX_SESSIONS = 20;

const SUGGESTIONS = [
  "How much did I spend this month?",
  "Add ₹150 coffee to Food",
  "Show my recent transactions",
];

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function inlineBold(text) {
  const parts = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<b key={key++}>{m[1]}</b>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

export default function FloatingAIChat() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const readyRef = useRef(false);
  const lastSavedRef = useRef({});
  const saveTimerRef = useRef(null);
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  const active = sessions.find((s) => s.id === activeId) || null;
  const messages = active?.messages || [];

  // Load: DB is source of truth, localStorage is the fast cache.
  useEffect(() => {
    let local = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      local = raw ? JSON.parse(raw) : [];
    } catch {
      /* ignore */
    }
    setSessions(local);

    api
      .get("/ai/sessions")
      .then(({ data }) => {
        for (const s of data) lastSavedRef.current[s.id] = JSON.stringify(s.messages || []);
        const merged = Array.from(new Map([...data, ...local].map((s) => [s.id, s])).values());
        setSessions(merged.slice(0, MAX_SESSIONS));
        readyRef.current = true;
      })
      .catch(() => {
        setSessions(local);
        readyRef.current = true;
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
    } catch {
      /* ignore */
    }
  }, [sessions]);

  useEffect(() => {
    if (!readyRef.current) return;
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
  }, [sessions]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy, open]);

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    let targetId = activeId;
    if (!targetId) {
      targetId = uid();
      setActiveId(targetId);
    }
    const existing = sessions.find((s) => s.id === targetId);
    const history = (existing ? existing.messages : [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    setSessions((prev) => {
      const now = new Date().toISOString();
      if (prev.some((s) => s.id === targetId)) {
        return prev.map((s) =>
          s.id === targetId
            ? { ...s, messages: [...s.messages, { id: uid(), role: "user", content: text, createdAt: now }], updatedAt: now }
            : s
        );
      }
      const title = text.length > 40 ? `${text.slice(0, 40)}…` : text;
      return [
        { id: targetId, title, messages: [{ id: uid(), role: "user", content: text, createdAt: now }], createdAt: now, updatedAt: now },
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
                messages: [...s.messages, { id: uid(), role: "assistant", content: data.reply, createdAt: new Date().toISOString() }],
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
                messages: [...s.messages, { id: uid(), role: "assistant", content: err.response?.data?.detail || "Sorry, something went wrong reaching the assistant.", error: true, createdAt: new Date().toISOString() }],
              }
            : s
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const isWelcome = messages.length === 0;

  return (
    <>
      {/* Floating action button */}
      <Fab
        size="medium"
        aria-label="AI assistant"
        onClick={() => setOpen(!open)}
        sx={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 1400,
          background: "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))",
          color: "#fff",
          boxShadow: "0 8px 22px var(--fm-primary-a30)",
          "&:hover": { background: "linear-gradient(135deg, var(--fm-primary-hover), var(--fm-primary))" },
        }}
      >
        {open ? <CloseIcon /> : <AutoAwesomeIcon />}
      </Fab>

      {/* Chat panel */}
      {open && (
        <Box
          sx={{
            position: "fixed",
            right: 20,
            bottom: 84,
            zIndex: 1400,
            width: 360,
            maxWidth: "min(360px, calc(100vw - 40px))",
            height: 500,
            maxHeight: "calc(100vh - 120px)",
            display: "flex",
            flexDirection: "column",
            borderRadius: "var(--fm-radius-xl)",
            bgcolor: "var(--fm-surface)",
            border: "1px solid var(--fm-card-border)",
            boxShadow: "0 16px 40px var(--fm-shadow-soft)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.5,
              py: 1,
              borderBottom: "1px solid var(--fm-card-border)",
              background: "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))",
              color: "#fff",
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 20 }} />
            <Typography sx={{ fontWeight: 700, fontSize: 14, flex: 1 }}>AI Assistant</Typography>
            <Tooltip title="Open full assistant">
              <IconButton size="small" onClick={() => navigate("/ai")} sx={{ color: "#fff", "&:hover": { bgcolor: "rgba(255,255,255,0.12)" } }}>
                <OpenInNewIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Messages */}
          <Box
            ref={scrollRef}
            sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1.5, display: "flex", flexDirection: "column", gap: 1, bgcolor: "var(--fm-bg)" }}
          >
            {isWelcome ? (
              <Box sx={{ textAlign: "center", mt: 2, px: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: "var(--fm-text-primary)" }}>
                  Need a hand?
                </Typography>
                <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", my: 1 }}>
                  Ask about transactions, budgets, subscriptions and more.
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, justifyContent: "center", mt: 1.5 }}>
                  {SUGGESTIONS.map((s) => (
                    <Chip key={s} label={s} clickable size="small" onClick={() => send(s)} sx={{ bgcolor: "var(--fm-bg-soft)", border: "1px solid var(--fm-card-border)", "&:hover": { borderColor: "var(--fm-primary-tint)", bgcolor: "var(--fm-bg-hover)" } }} />
                  ))}
                </Box>
              </Box>
            ) : (
              messages.map((msg) => (
                <Box
                  key={msg.id}
                  sx={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "min(88%, 300px)",
                    px: 1.5,
                    py: 1,
                    borderRadius: "var(--fm-radius-lg)",
                    borderTopRightRadius: msg.role === "user" ? 4 : undefined,
                    borderTopLeftRadius: msg.role === "user" ? undefined : 4,
                    background: msg.role === "user" ? "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))" : "var(--fm-surface)",
                    border: msg.role === "user" ? "none" : "1px solid var(--fm-card-border)",
                    color: msg.role === "user" ? "#fff" : "var(--fm-text-primary)",
                    fontSize: 13,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    boxShadow: msg.role === "user" ? "0 4px 12px var(--fm-primary-a30)" : "var(--fm-shadow)",
                  }}
                >
                  {msg.role === "user" ? msg.content : inlineBold(msg.content)}
                </Box>
              ))
            )}
            {busy && (
              <Box sx={{ alignSelf: "flex-start", display: "flex", gap: 0.75, alignItems: "center", px: 1.5, py: 1, borderRadius: "var(--fm-radius-lg)", bgcolor: "var(--fm-surface)", border: "1px solid var(--fm-card-border)" }}>
                {[0, 1, 2].map((d) => <Box key={d} sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "var(--fm-text-subtle)", animation: "fmBlink 1.2s infinite", animationDelay: `${d * 0.2}s` }} />)}
              </Box>
            )}
          </Box>

          {/* Input */}
          <Box sx={{ p: 1.25, borderTop: "1px solid var(--fm-card-border)", bgcolor: "var(--fm-surface)" }}>
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-end" }}>
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={3}
                placeholder='Try "add ₹150 coffee to Food"...'
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
                sx={{ width: 40, height: 40, background: "linear-gradient(135deg, var(--fm-primary), var(--fm-primary-deep))", color: "#fff", "&:hover": { background: "linear-gradient(135deg, var(--fm-primary-hover), var(--fm-primary))" }, "&.Mui-disabled": { bgcolor: "var(--fm-bg-hover)", color: "var(--fm-text-faint)", background: "none" } }}
              >
                {busy ? <CircularProgress size={16} color="inherit" /> : <SendIcon fontSize="small" />}
              </IconButton>
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
}

function truncate(text) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}