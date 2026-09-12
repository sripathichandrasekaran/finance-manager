import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PageHeader from "../components/PageHeader.jsx";
import { MESSAGE_SCENARIOS } from "../constants/messageKit.js";
import api from "../services/api.js";

const MISSING = "\u0000";

function fillTemplate(template, ctx) {
  let text = template.replace(/\{(\w+)\}/g, (m, k) => {
    const v = ctx[k];
    return v !== undefined && v !== null && String(v).trim() !== ""
      ? String(v)
      : MISSING;
  });
  text = text.replace(/\{\{([\s\S]*?)\}\}/g, (m, inner) =>
    inner.includes(MISSING) ? "" : inner
  );
  text = text.replace(/\u0000/g, "");
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

export default function MessageKit() {
  const [companies, setCompanies] = useState([]);
  const [pulseByName, setPulseByName] = useState({});
  const [selectedId, setSelectedId] = useState("");
  const [toast, setToast] = useState({ open: false, msg: "" });
  const [category, setCategory] = useState("All");

  useEffect(() => {
    api.get("/companies?active=true&page_size=500").then((res) => {
      setCompanies(res.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/companies/client-pulse").then((res) => {
      const map = {};
      (res.data || []).forEach((r) => {
        map[r.name] = r;
      });
      setPulseByName(map);
    }).catch(() => {});
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedId) || null,
    [companies, selectedId]
  );

  const ctx = useMemo(() => {
    const pulse = selectedCompany ? pulseByName[selectedCompany.name] : null;
    return {
      name: selectedCompany?.name || "there",
      industry: selectedCompany?.industry || "",
      amount: pulse ? `\u20b9${(pulse.total_paid || 0).toLocaleString("en-IN")}` : "",
      days: pulse ? pulse.days_since_last_invoice : "",
      lastDate: pulse ? pulse.last_invoice_date : "",
      invoices: pulse ? pulse.invoice_count : "",
    };
  }, [selectedCompany, pulseByName]);

  const scenarios = useMemo(
    () =>
      category === "All"
        ? MESSAGE_SCENARIOS
        : MESSAGE_SCENARIOS.filter((s) => s.category === category),
    [category]
  );

  const categories = useMemo(
    () => ["All", ...new Set(MESSAGE_SCENARIOS.map((s) => s.category))],
    []
  );

  const copyMessage = (s) => {
    const text = fillTemplate(s.template, ctx);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {});
    const who = selectedCompany ? ` for ${selectedCompany.name}` : "";
    setToast({ open: true, msg: `"${s.title}" copied${who} — paste and send` });
  };

  return (
    <Box>
      <PageHeader
        title="Message Kit"
        description="Premium copy-paste messages for every client situation — auto-filled with your real numbers"
        actions={
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            {selectedCompany && (() => {
              const p = pulseByName[selectedCompany.name];
              return p ? (
                <Chip
                  label={`\u20b9${(p.total_paid || 0).toLocaleString("en-IN")} paid · ${p.days_since_last_invoice}d since last · ${p.invoice_count} invoice(s)`}
                  color="success"
                  size="small"
                  variant="outlined"
                />
              ) : null;
            })()}
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>Auto-fill client</InputLabel>
              <Select
                value={selectedId}
                label="Auto-fill client"
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <MenuItem value="">— no client (generic) —</MenuItem>
                {companies.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                    {c.industry ? ` · ${c.industry}` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        }
      />

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        {categories.map((c) => (
          <Chip
            key={c}
            label={c}
            size="small"
            onClick={() => setCategory(c)}
            sx={{
              cursor: "pointer",
              ...(c === category
                ? { bgcolor: "rgba(196,190,247,0.16)", color: "#FFFFFF" }
                : { color: "var(--fm-text-secondary)" }),
            }}
          />
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        {scenarios.map((s) => (
          <Card key={s.id} sx={{ border: "1px solid var(--fm-border)", borderRadius: "var(--fm-radius-md)", display: "flex", flexDirection: "column" }}>
            <CardContent sx={{ p: 2, pb: 1.5, flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{s.title}</Typography>
                <Chip size="small" label={s.category} sx={{ height: 18, "& .MuiChip-label": { fontSize: 11, px: 1 } }} color="info" variant="outlined" />
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ color: "var(--fm-text-secondary)" }}>
                  <b>When:</b> {s.when}
                </Typography>
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ color: "var(--fm-text-secondary)" }}>
                  <b>Tone:</b> {s.tone}
                </Typography>
              </Box>
              <Box
                sx={{
                  border: "1px solid var(--fm-border)",
                  borderRadius: "var(--fm-radius-sm)",
                  p: 1.5,
                  mb: 1.5,
                  bgcolor: "rgba(255,255,255,0.02)",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <Typography
                  sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.55, color: "var(--fm-text-primary)" }}
                >
                  {fillTemplate(s.template, ctx)}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="contained"
                startIcon={<ContentCopyIcon />}
                onClick={() => copyMessage(s)}
                sx={{ alignSelf: "flex-start", textTransform: "none" }}
              >
                Copy &amp; send
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1, color: "var(--fm-text-secondary)" }}>
        <AutoAwesomeIcon sx={{ fontSize: 16 }} />
        <Typography variant="caption">
          Messages auto-fill from your real client data: amount paid, days silent, invoice count. Pick a client above to personalize; leave empty for a generic version.
        </Typography>
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast({ open: false })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}