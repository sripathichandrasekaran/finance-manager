import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import RadarIcon from "@mui/icons-material/Radar";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SendIcon from "@mui/icons-material/Send";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import {
  fetchOpportunities,
  fetchOpportunityStats,
  fetchPipeline,
  refreshRadar,
  updateOpportunity,
  deleteOpportunity,
  draftProposal,
  markWon,
} from "../store/slices/opportunitiesSlice.js";

const STATUS_COLORS = {
  new: "info",
  applied: "warning",
  replied: "secondary",
  won: "success",
  lost: "error",
  ignored: "default",
};

const STATUS_LABELS = {
  new: "New",
  applied: "Applied",
  replied: "Replied",
  won: "Won",
  lost: "Lost",
  ignored: "Ignored",
};

function scoreColor(score) {
  if (score >= 70) return "success";
  if (score >= 45) return "warning";
  return "default";
}

function timeAgo(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function budgetLabel(o) {
  const lo = o.budget_min ?? null;
  const hi = o.budget_max ?? null;
  if (lo == null && hi == null) return "\u2014";
  const cur = o.currency || "";
  const fmt = (v) => Number(v).toLocaleString();
  if (lo != null && hi != null) return `${fmt(lo)}\u2013${fmt(hi)} ${cur}`;
  if (hi != null) return `up to ${fmt(hi)} ${cur}`;
  if (lo != null && lo > 0) return `from ${fmt(lo)} ${cur}`;
  return "\u2014";
}

function copyText(text) {
  try {
    navigator.clipboard.writeText(text || "");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text || "";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function fmtDollar(v) {
  if (!v || v <= 0) return "\u2014";
  const n = Number(v);
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString("en-IN")}`;
}

export default function GigRadar() {
  const dispatch = useDispatch();
  const { items, total, stats, pipeline, loading, refreshing, drafting } = useSelector(
    (s) => s.opportunities
  );

  const [status, setStatus] = useState("new");
  const [minScore, setMinScore] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [detail, setDetail] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [wonTarget, setWonTarget] = useState(null);
  const [wonForm, setWonForm] = useState({ company_name: "", project_name: "", amount: "" });
  const [snack, setSnack] = useState(null);

  const reload = (extra = {}) => {
    dispatch(
      fetchOpportunities({
        status,
        min_score: minScore || undefined,
        q: query || undefined,
        page_size: rowsPerPage,
        page: page + 1,
        ...extra,
      })
    );
    dispatch(fetchOpportunityStats());
    dispatch(fetchPipeline());
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, minScore, query, page, rowsPerPage]);

  const doRefresh = async () => {
    const result = await dispatch(refreshRadar()).unwrap().catch((e) => e);
    if (result && result.added !== undefined) {
      const cleaned = result.pruned ? `, ${result.pruned} outdated removed` : "";
      setSnack({
        severity: "success",
        message: `Radar scan complete \u2014 ${result.added} new, ${result.updated} updated${cleaned}.`,
      });
    }
    reload();
  };

  const setOppStatus = async (opp, next) => {
    await dispatch(updateOpportunity({ id: opp.id, status: next }));
    if (detail?.id === opp.id) {
      setDetail({ ...detail, status: next });
    }
    reload();
  };

  const applyOpp = async (opp) => {
    const hadDraft = Boolean(draftText.trim());
    if (hadDraft) copyText(draftText);
    await setOppStatus(opp, "applied");
    if (opp.url) window.open(opp.url, "_blank", "noopener");
    setSnack({
      severity: "success",
      message: hadDraft
        ? "Proposal copied \u2014 paste it on the platform to apply."
        : "Gig opened on the platform \u2014 paste your proposal there to apply.",
    });
  };

  const remove = async (opp) => {
    await dispatch(deleteOpportunity(opp.id));
    if (detail?.id === opp.id) setDetail(null);
    reload();
  };

  const openDetail = (opp) => {
    setDetail(opp);
    setDraftText(opp.draft || "");
  };

  const generateDraft = async () => {
    const result = await dispatch(draftProposal(detail.id)).unwrap().catch((e) => e);
    if (result && result.id) {
      setDraftText(result.draft || "");
      setDetail(result);
    } else {
      setSnack({ severity: "error", message: result?.message || String(result || "Draft failed") });
    }
  };

  const saveDraft = async () => {
    const result = await dispatch(updateOpportunity({ id: detail.id, draft: draftText }))
      .unwrap()
      .catch((e) => e);
    if (result && result.id) setDetail(result);
  };

  const openWon = (opp) => {
    setWonTarget(opp);
    setWonForm({ company_name: "", project_name: "", amount: "" });
  };

  const rowDraft = async (opp) => {
    const result = await dispatch(draftProposal(opp.id)).unwrap().catch((e) => e);
    if (result && result.id) {
      setDetail(result);
      setDraftText(result.draft || "");
      setSnack({ severity: "success", message: "Proposal draft ready." });
    } else {
      setSnack({ severity: "error", message: result?.message || String(result || "Draft failed") });
    }
  };

  const confirmWon = async () => {
    await dispatch(
      markWon({
        id: wonTarget.id,
        company_name: wonForm.company_name || wonTarget.title,
        project_name: wonForm.project_name || wonTarget.title,
        amount: wonForm.amount !== "" ? Number(wonForm.amount) : undefined,
      })
    )
      .unwrap()
      .then(() => {
        setSnack({ severity: "success", message: "Opportunity won \u2014 Company & project created." });
        setWonTarget(null);
        if (detail?.id === wonTarget.id) setDetail(null);
        reload();
      })
      .catch((e) => setSnack({ severity: "error", message: e || "Failed to mark as won" }));
  };

  const visibleRows = items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <PageHeader
        title="Gig Radar"
        description="Freelance opportunities captured from Reddit, Freelancer.com + job feeds, scored against your profile"
        actions={
          <Button
            variant="contained"
            startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={doRefresh}
            disabled={refreshing}
          >
            Scan sources
          </Button>
        }
      />

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <StatCard title="New" value={stats.new} currency={false} color="var(--fm-primary)" icon={<RadarIcon />} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Applied / Replied" value={stats.applied + stats.replied} currency={false} color="var(--fm-warning, #f59e0b)" icon={<RadarIcon />} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Won" value={stats.won} currency={false} color="var(--fm-success)" icon={<EmojiEventsIcon />} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Total captured" value={stats.total} currency={false} icon={<RadarIcon />} loading={loading} />
        </Grid>
      </Grid>

      {/* Freelance pipeline — gig budgets in play while you chase them */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 13 }}>Freelance pipeline</Typography>
            <Typography sx={{ fontSize: 11, color: "var(--fm-text-secondary)" }}>
              approx \u00b7 from gig budgets \u00b7 mixed currencies as-is
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              gap: 1.5,
            }}
          >
            <Box sx={{ bgcolor: "var(--fm-bg-soft)", borderRadius: 2, p: 1.5 }}>
              <Typography sx={{ fontSize: 11, color: "var(--fm-text-secondary)", mb: 0.5 }}>
                Active \u2014 applied / replied
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: "var(--fm-warning, #f59e0b)" }}>
                {pipeline.active_count} gig{pipeline.active_count === 1 ? "" : "s"}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "var(--fm-text-secondary)" }}>
                {fmtDollar(pipeline.active_value_min)}
                {pipeline.active_value_max > pipeline.active_value_min
                  ? ` \u2013 ${fmtDollar(pipeline.active_value_max)}`
                  : ""}{" "}
                in play
              </Typography>
            </Box>
            <Box sx={{ bgcolor: "var(--fm-bg-soft)", borderRadius: 2, p: 1.5 }}>
              <Typography sx={{ fontSize: 11, color: "var(--fm-text-secondary)", mb: 0.5 }}>
                Fresh \u2014 not yet applied
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: "var(--fm-primary)" }}>
                {pipeline.new_count} gig{pipeline.new_count === 1 ? "" : "s"}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "var(--fm-text-secondary)" }}>
                {fmtDollar(pipeline.new_value)} up for grabs
              </Typography>
            </Box>
            <Box sx={{ bgcolor: "var(--fm-bg-soft)", borderRadius: 2, p: 1.5 }}>
              <Typography sx={{ fontSize: 11, color: "var(--fm-text-secondary)", mb: 0.5 }}>
                Won
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: "var(--fm-success)" }}>
                {pipeline.won_count} gig{pipeline.won_count === 1 ? "" : "s"}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "var(--fm-text-secondary)" }}>
                {fmtDollar(pipeline.won_value)} secured
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
            <TextField
              select
              size="small"
              label="Status"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(0); }}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="new">New</MenuItem>
              <MenuItem value="applied">Applied</MenuItem>
              <MenuItem value="replied">Replied</MenuItem>
              <MenuItem value="won">Won</MenuItem>
              <MenuItem value="lost">Lost</MenuItem>
              <MenuItem value="ignored">Ignored</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Min score"
              value={minScore}
              onChange={(e) => { setMinScore(e.target.value); setPage(0); }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">Any score</MenuItem>
              <MenuItem value="80">80+ (hot leads)</MenuItem>
              <MenuItem value="60">60+</MenuItem>
              <MenuItem value="45">45+</MenuItem>
            </TextField>
            <TextField
              size="small"
              placeholder="Search title\u2026"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: "var(--fm-text-faint)" }} />,
              }}
              sx={{ minWidth: 220 }}
            />
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Opportunity</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Budget</TableCell>
                  <TableCell>Posted</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        icon={<RadarIcon />}
                        title={loading ? "Scanning sources\u2026" : "No opportunities here"}
                        subtitle={
                          loading
                            ? "Finding freelance gigs that match your profile\u2026"
                            : "Hit \u201cScan sources\u201d to pull fresh gigs from Reddit (r/forhire, r/slavelance), Freelancer.com, Truelancer, Remotive, RemoteOK and WeWorkRemotely."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((o) => (
                    <TableRow key={o.id} hover sx={{ cursor: "pointer" }} onClick={() => openDetail(o)}>
                      <TableCell sx={{ maxWidth: 460 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Typography
                            sx={{
                              fontWeight: o.status === "new" ? 700 : 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "13px",
                            }}
                          >
                            {o.title}
                          </Typography>
                          {o.url && (
                            <a href={o.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              <OpenInNewIcon sx={{ fontSize: 14, color: "var(--fm-text-faint)", verticalAlign: "middle" }} />
                            </a>
                          )}
                        </Box>
                        {o.skills && (
                          <Typography sx={{ fontSize: 11, color: "var(--fm-text-secondary)", mt: 0.25 }}>
                            {o.skills}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={o.source_label || o.source} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={scoreColor(o.score)} label={o.score} />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>{budgetLabel(o)}</TableCell>
                      <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>{timeAgo(o.posted_at)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TextField
                          select
                          size="small"
                          value={o.status}
                          onChange={(e) => setOppStatus(o, e.target.value)}
                          sx={{ minWidth: 110, "& .MuiInputBase-input": { py: 0.75, fontSize: 12 } }}
                        >
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <MenuItem key={k} value={k}>{v}</MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Generate AI proposal">
                          <IconButton size="small" onClick={() => rowDraft(o)}>
                            <AutoAwesomeIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Mark as won">
                          <IconButton size="small" color="success" onClick={() => openWon(o)}>
                            <EmojiEventsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => remove(o)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", mt: 1, gap: 2 }}>
            <Typography sx={{ fontSize: 12, color: "var(--fm-text-secondary)" }}>
              {total} result{total === 1 ? "" : "s"}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Button size="small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Typography sx={{ fontSize: 12, color: "var(--fm-text-secondary)" }}>Page {page + 1}</Typography>
              <Button size="small" disabled={(page + 1) * rowsPerPage >= total} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 8 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.35 }}>{detail?.title}</Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
                <Chip size="small" variant="outlined" label={detail?.source_label || detail?.source} />
                <Chip size="small" color={scoreColor(detail?.score || 0)} label={`Score ${detail?.score ?? 0}`} />
                <Chip size="small" color={STATUS_COLORS[detail?.status] || "default"} label={STATUS_LABELS[detail?.status] || detail?.status} />
                <Typography sx={{ fontSize: 11, color: "var(--fm-text-secondary)" }}>
                  {timeAgo(detail?.posted_at)} {"\u00b7"} {detail?.location || ""}
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {detail?.fit_reason && (
              <Typography sx={{ fontSize: 13, color: "var(--fm-text-secondary)" }}>
                <b>Fit:</b> {detail.fit_reason}
              </Typography>
            )}
            <Typography
              sx={{
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                maxHeight: 240,
                overflowY: "auto",
                bgcolor: "var(--fm-bg-soft)",
                borderRadius: 2,
                p: 1.5,
              }}
            >
              {detail?.description || "No description available."}
            </Typography>

            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: 13, mb: 1 }}>Proposal draft</Typography>
              <TextField
                multiline
                minRows={5}
                fullWidth
                size="small"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Generate a tailored proposal with AI, or write your own here."
                disabled={drafting}
              />
              <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                <Button
                  size="small"
                  startIcon={drafting ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                  onClick={generateDraft}
                  disabled={drafting}
                >
                  {detail?.draft ? "Regenerate draft" : "Generate draft (AI)"}
                </Button>
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => { copyText(draftText); setSnack({ severity: "success", message: "Draft copied to clipboard." }); }}>
                  Copy draft
                </Button>
                <Button size="small" onClick={saveDraft} disabled={!draftText.trim() || draftText === (detail?.draft || "")}>
                  Save draft
                </Button>
              </Box>
            </Box>

            <Typography sx={{ fontSize: 12, color: "var(--fm-text-secondary)" }}>
              Status here is tracked only inside this app. To actually apply, hit{" "}
              <b>Apply</b> below \u2014 it copies your draft and opens the gig on{" "}
              {detail?.source_label || "the platform"} where you paste it in.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 0.5 }}>
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<SendIcon />}
            onClick={() => applyOpp(detail)}
          >
            Apply
          </Button>
          <Button size="small" variant="contained" color="secondary" onClick={() => setOppStatus(detail, "replied")}>
            Replied
          </Button>
          <Button size="small" variant="contained" color="success" startIcon={<EmojiEventsIcon />} onClick={() => openWon(detail)}>
            Won
          </Button>
          <Box sx={{ flex: 1 }} />
          {detail?.url && (
            <Button size="small" endIcon={<OpenInNewIcon />} href={detail.url} target="_blank" rel="noopener noreferrer">
              Open source
            </Button>
          )}
          <Button size="small" color="error" onClick={() => setOppStatus(detail, "lost")}>
            Lost
          </Button>
          <Button size="small" onClick={() => setOppStatus(detail, "ignored")}>
            Ignore
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark as won dialog */}
      <Dialog open={Boolean(wonTarget)} onClose={() => setWonTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Mark as won</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Typography sx={{ fontSize: 13, color: "var(--fm-text-secondary)" }}>
              Creates a Company and an active Project so you can invoice and track it.
            </Typography>
            <TextField
              size="small"
              fullWidth
              label="Company name"
              value={wonForm.company_name}
              onChange={(e) => setWonForm({ ...wonForm, company_name: e.target.value })}
            />
            <TextField
              size="small"
              fullWidth
              label="Project name"
              value={wonForm.project_name}
              onChange={(e) => setWonForm({ ...wonForm, project_name: e.target.value })}
            />
            <TextField
              size="small"
              fullWidth
              type="number"
              label="Project value (\u20b9) \u2014 optional"
              value={wonForm.amount}
              onChange={(e) => setWonForm({ ...wonForm, amount: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setWonTarget(null)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={confirmWon}>
            Convert to project
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack?.severity || "info"} onClose={() => setSnack(null)} variant="filled">
          {snack?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}