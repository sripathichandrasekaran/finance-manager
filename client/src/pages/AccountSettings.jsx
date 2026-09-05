import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import StorefrontIcon from "@mui/icons-material/Storefront";
import LogoutIcon from "@mui/icons-material/Logout";
import DevicesIcon from "@mui/icons-material/Devices";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { fetchSessions, revokeSession, logout } from "../store/slices/authSlice.js";
import { formatDateTime } from "../utils/timezone.js";
import api from "../services/api.js";

const PROFILE_FIELDS = [
  ["business_name", "Business name (shown as your brand on invoices)"],
  ["owner_name", "Your / owner name"],
  ["address", "Billing address (street, building, area)"],
  ["city", "City"],
  ["state", "State"],
  ["state_code", "State code (GST)"],
  ["pincode", "PIN"],
  ["gstin", "Your GSTIN (leave blank if not registered)"],
  ["phone", "Phone"],
  ["email", "Email"],
];

export default function AccountSettings() {
  const dispatch = useDispatch();
  const { username, authEnabled, sessions, sessionsTotal, loading } = useSelector((s) => s.auth);
  const [profile, setProfile] = useState({});
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    dispatch(fetchSessions(page + 1));
    api.get("/business-profile")
      .then(({ data }) => setProfile(data || {}))
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [dispatch, page]);

  useEffect(() => {
    if (!loading && sessions.length === 0 && sessionsTotal > 0) setPage(0);
  }, [sessions.length, sessionsTotal, loading]);

  const setField = (key) => (e) => setProfile((p) => ({ ...p, [key]: e.target.value }));
  const profileReady = Boolean(profile.business_name || profile.address || profile.gstin);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const payload = {};
      Object.entries(profile).forEach(([k, v]) => {
        const val = typeof v === "string" ? v.trim() : v;
        payload[k] = val === "" ? (PROFILE_FIELDS.some(([f]) => f === k) ? null : val) : val;
      });
      const { data } = await api.put("/business-profile", payload);
      setProfile(data || {});
      setSaved(true);
    } catch (err) {
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader title="Account settings" description="Profile, active login sessions, and your invoice details" />

      <Card sx={{ mb: 2, border: "1px solid var(--fm-border)", borderRadius: "var(--fm-radius-md)" }}>
        <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, "&:last-child": { pb: 2.5 } }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              fontSize: 24,
              fontWeight: 700,
              bgcolor: "rgba(196,190,247,0.65)",
              color: "#5B4BD4",
            }}
          >
            {(username || "A").charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{username || "Admin"}</Typography>
            <Typography sx={{ color: "var(--fm-text-secondary)", fontSize: 13 }}>
              Single-user account · signed in
            </Typography>
          </Box>
          <Chip
            size="small"
            color={authEnabled ? "success" : "default"}
            label={authEnabled ? "Password protected" : "Auth disabled"}
          />
        </CardContent>
      </Card>

      <Card sx={{ mb: 2, border: "1px solid var(--fm-border)", borderRadius: "var(--fm-radius-md)" }}>
        <CardContent sx={{ "&:last-child": { pb: 2.5 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <StorefrontIcon sx={{ fontSize: 18, color: "var(--fm-text-secondary)" }} />
            <Typography sx={{ fontWeight: 650, fontSize: 14 }}>Business &amp; invoice details</Typography>
            {profileReady && (
              <Chip size="small" color="success" label="Configured" sx={{ ml: 1 }} />
            )}
          </Box>
          <Typography sx={{ color: "var(--fm-text-secondary)", fontSize: 13, mb: 2 }}>
            Your billing address, GSTIN and contact details. These appear as the "From" block on every
            invoice — nothing is shown if you leave it blank.
          </Typography>
          {profileLoading ? (
            <Typography sx={{ color: "var(--fm-text-secondary)", fontSize: 13 }}>Loading…</Typography>
          ) : (
            <Box component="form" onSubmit={saveProfile}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                {PROFILE_FIELDS.map(([key, label]) => (
                  <TextField
                    key={key}
                    label={label}
                    fullWidth
                    multiline={key === "address"}
                    minRows={key === "address" ? 2 : undefined}
                    value={profile[key] ?? ""}
                    onChange={setField(key)}
                    inputProps={key === "state_code" ? { maxLength: 2 } : key === "pincode" ? { maxLength: 6 } : key === "gstin" ? { maxLength: 15 } : undefined}
                  />
                ))}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={saving}
                  sx={{ textTransform: "none" }}
                >
                  {saving ? "Saving…" : "Save business details"}
                </Button>
                {saved && <Alert severity="success" sx={{ py: 0, flex: 1 }}>Saved — will appear on new invoices.</Alert>}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ border: "1px solid var(--fm-border)", borderRadius: "var(--fm-radius-md)" }}>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.25, pt: 2, pb: 1.5 }}>
            <DevicesIcon sx={{ fontSize: 18, color: "var(--fm-text-secondary)" }} />
            <Typography sx={{ fontWeight: 650, fontSize: 14 }}>Login sessions</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: "12px" }}>When</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: "12px" }}>Device / Browser</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: "12px" }}>IP address</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: "12px" }}>Expires</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: "12px" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: "12px" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: "var(--fm-text-secondary)" }}>
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState dense icon={<DevicesIcon />} title="No sessions recorded" subtitle="Your login sessions will appear here." />
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ fontSize: "12px", whiteSpace: "nowrap" }}>{formatDateTime(s.created_at)}</TableCell>
                      <TableCell sx={{ fontSize: "12px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.user_agent || "\u2014"}
                      </TableCell>
                      <TableCell sx={{ fontSize: "12px" }}>{s.ip_address || "\u2014"}</TableCell>
                      <TableCell sx={{ fontSize: "12px", whiteSpace: "nowrap" }}>{formatDateTime(s.expires_at)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={s.current ? "primary" : s.active ? "success" : "default"}
                          label={s.current ? "Current" : s.active ? "Active" : "Revoked"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {s.active && !s.current && (
                          <Tooltip title="Revoke session">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() =>
                                dispatch(revokeSession(s.id)).then(() => dispatch(fetchSessions(page + 1)))
                              }
                            >
                              <LogoutIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={sessionsTotal}
            page={page}
            onPageChange={(e, p) => setPage(p)}
            rowsPerPage={50}
            rowsPerPageOptions={[50]}
            onRowsPerPageChange={() => {}}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end", px: 2.25, py: 2 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={() => dispatch(logout())}
              sx={{ textTransform: "none" }}
            >
              Log out everywhere
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
