import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import * as Yup from "yup";
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
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress from "@mui/material/LinearProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import BusinessIcon from "@mui/icons-material/Business";
import EmptyState from "../components/EmptyState.jsx";
import DateField from "../components/DateField.jsx";

import { fetchCompanies, createCompany, updateCompany, deleteCompany } from "../store/slices/companiesSlice.js";
import { fetchCompanyProjectReport } from "../store/slices/projectsSlice.js";
import api from "../services/api.js";
import PageHeader from "../components/PageHeader.jsx";

const EMPTY = { name: "", industry: "", contact_email: "", contact_phone: "", notes: "", contract_type: "hourly", hourly_rate: "", fixed_price: "", contract_start: "", contract_end: "", payment_terms: "", gstin: "", billing_address: "", city: "", state: "", state_code: "", pincode: "" };

function toNull(v) {
  if (v === null || v === undefined) return null;
  return String(v).trim() === "" ? null : String(v).trim();
}

function healthColor(score) {
  if (score >= 80) return "var(--fm-success)";
  if (score >= 50) return "var(--fm-warning-bright, #f59e0b)";
  return "var(--fm-danger)";
}

function healthLabel(score) {
  if (score >= 80) return "Healthy";
  if (score >= 50) return "Fair";
  return "At Risk";
}

export default function Companies() {
  const dispatch = useDispatch();
  const { items, total, loading } = useSelector((s) => s.companies);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [healthScores, setHealthScores] = useState({});
  const [projectSummaries, setProjectSummaries] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [pulse, setPulse] = useState(null);
  const [toast, setToast] = useState({ open: false, msg: "" });

  const formik = useFormik({
    initialValues: EMPTY,
    validationSchema: Yup.object({
      name: Yup.string().trim().required("Company name is required"),
      contact_email: Yup.string().email("Enter a valid email"),
      hourly_rate: Yup.number().typeError("Enter a valid rate").min(0, "Rate must be 0 or more"),
      fixed_price: Yup.number().typeError("Enter a valid price").min(0, "Price must be 0 or more"),
      contract_start: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
      contract_end: Yup.string()
        .matches(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
        .test("end-after-start", "End date must be after the start date", function (value) {
          const { contract_start } = this.parent;
          if (!value || !contract_start) return true;
          return value >= contract_start;
        }),
      payment_terms: Yup.string(),
    }),
    onSubmit: async (values) => {
      const payload = {
        ...values,
        hourly_rate: values.hourly_rate ? Number(values.hourly_rate) : null,
        fixed_price: values.fixed_price ? Number(values.fixed_price) : null,
        contract_type: values.contract_type || "hourly",
        contract_start: values.contract_start || null,
        contract_end: values.contract_end || null,
        payment_terms: values.payment_terms || null,
        gstin: toNull(values.gstin),
        billing_address: toNull(values.billing_address),
        city: toNull(values.city),
        state: toNull(values.state),
        state_code: toNull(values.state_code),
        pincode: toNull(values.pincode),
      };
      if (editing) {
        await dispatch(updateCompany({ id: editing.id, ...payload }));
      } else {
        await dispatch(createCompany(payload));
      }
      setDialogOpen(false);
      dispatch(fetchCompanies({ page: page + 1, page_size: rowsPerPage }));
    },
  });

  useEffect(() => {
    dispatch(fetchCompanies({ page: page + 1, page_size: rowsPerPage }));
  }, [dispatch, page, rowsPerPage]);

  useEffect(() => {
    if (!loading && items.length === 0 && total > 0) setPage(0);
  }, [items.length, total, loading]);

  useEffect(() => {
    if (items.length === 0) return;
    Promise.all(
      items.map((c) =>
        dispatch(fetchCompanyProjectReport(c.id)).then((res) => {
          if (!res.error && res.payload) return [c.id, res.payload];
          return null;
        })
      )
    ).then((results) => {
      const map = {};
      results.filter(Boolean).forEach(([id, report]) => {
        map[id] = {
          count: report.project_count || report.projects?.length || 0,
          profit: report.profit || 0,
          income: report.income || 0,
          expenses: report.expenses || 0,
        };
      });
      setProjectSummaries(map);
    });
  }, [items, dispatch]);

  useEffect(() => {
    if (items.length === 0) return;
    api.get("/health/client-health").then((res) => {
      const map = {};
      (res.data || []).forEach((h) => {
        map[h.company_id] = h.health_score;
      });
      setHealthScores(map);
    }).catch(() => {});
  }, [items]);

  useEffect(() => {
    api.get("/companies/client-pulse").then((res) => {
      setPulse(res.data || []);
    }).catch(() => {});
  }, []);

  const pulseCounts = useMemo(() => {
    const c = { hot: 0, active: 0, dormant: 0, cold: 0 };
    (pulse || []).forEach((r) => {
      if (r.tier in c) c[r.tier] += 1;
    });
    return c;
  }, [pulse]);

  const revivalNeeds = useMemo(
    () => (pulse || []).filter((r) => r.revival_message),
    [pulse]
  );

  const copyRevival = (c) => {
    const text = c.revival_message || "";
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {});
    setToast({ open: true, msg: `Revival message copied for ${c.name} — paste in email or WhatsApp` });
  };

  const openAdd = () => {
    setEditing(null);
    formik.resetForm();
    formik.setErrors({});
    formik.setTouched({});
    setDialogOpen(true);
  };
  const openEdit = (c) => {
    setEditing(c);
    formik.setValues({
      name: c.name,
      industry: c.industry || "",
      contact_email: c.contact_email || "",
      contact_phone: c.contact_phone || "",
      notes: c.notes || "",
      contract_type: c.contract_type || "hourly",
      hourly_rate: c.hourly_rate || "",
      fixed_price: c.fixed_price || "",
      contract_start: c.contract_start || "",
      contract_end: c.contract_end || "",
      payment_terms: c.payment_terms || "",
      gstin: c.gstin || "",
      billing_address: c.billing_address || "",
      city: c.city || "",
      state: c.state || "",
      state_code: c.state_code || "",
      pincode: c.pincode || "",
    });
    formik.setErrors({});
    formik.setTouched({});
    setDialogOpen(true);
  };

  const handleFormClose = () => {
    setDialogOpen(false);
    formik.resetForm();
    formik.setErrors({});
  };

  const toggleActive = (c) => {
    dispatch(updateCompany({ id: c.id, active: !c.active })).then(() => {
      dispatch(fetchCompanies({ page: page + 1, page_size: rowsPerPage }));
    });
  };
  const remove = (id) => {
    dispatch(deleteCompany(id)).then(() => {
      dispatch(fetchCompanies({ page: page + 1, page_size: rowsPerPage }));
    });
  };

  return (
    <Box>
      <PageHeader
        title="Companies"
        description="Clients you freelance for"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            Add Company
          </Button>
        }
      />

      {pulse && pulse.length > 0 && (
        <Card sx={{ mb: 2, border: "1px solid var(--fm-border)", borderRadius: "var(--fm-radius-md)" }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: revivalNeeds.length ? 1.5 : 0 }}>
              <Box sx={{ mr: "auto", minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 0.75 }}>
                  <NotificationsActiveIcon sx={{ fontSize: 18, color: "var(--fm-warning, #f59e0b)" }} />
                  Client pulse
                </Typography>
                <Typography variant="caption" sx={{ color: "var(--fm-text-secondary)", display: "block" }}>
                  Who is paying you right now, and who went quiet — repeat clients are your cheapest work.
                </Typography>
              </Box>
              <Chip size="small" label={`Hot ${pulseCounts.hot}`} color="success" variant="outlined" />
              <Chip size="small" label={`Active ${pulseCounts.active}`} color="info" variant="outlined" />
              <Chip size="small" label={`Dormant ${pulseCounts.dormant}`} color="warning" variant="outlined" />
              <Chip size="small" label={`Cold ${pulseCounts.cold}`} color="error" variant="outlined" />
            </Box>
            {revivalNeeds.length > 0 && (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
                {revivalNeeds.map((c) => (
                  <Box key={c.company_id} sx={{ border: "1px solid var(--fm-border)", borderRadius: "var(--fm-radius-md)", p: 1.5, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</Typography>
                      <Chip
                        size="small"
                        label={`${c.days_since_last_invoice}d silent`}
                        sx={{ height: 18, flexShrink: 0, "& .MuiChip-label": { fontSize: 11, px: 1 } }}
                        color={c.tier === "cold" ? "error" : "warning"}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ display: "block", color: "var(--fm-text-secondary)", mb: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.industry || "\u2014"} · ₹{(c.total_paid || 0).toLocaleString("en-IN")} paid already · {c.invoice_count} invoice{c.invoice_count === 1 ? "" : "s"} · last {c.last_invoice_date}
                    </Typography>
                    <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => copyRevival(c)}>
                      Copy revival message
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Industry</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Rate</TableCell>
                  <TableCell>Contract</TableCell>
                  <TableCell>Health</TableCell>
                  <TableCell>Projects</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: "var(--fm-text-secondary)" }}>
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState icon={<BusinessIcon />} title="No companies yet" subtitle="Add the clients you freelance for." />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((c) => {
                    const score = healthScores[c.id];
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                        <TableCell>{c.industry || "\u2014"}</TableCell>
                        <TableCell>{c.contact_email || "\u2014"}
                          {c.gstin && (
                            <Typography variant="caption" sx={{ display: "block", color: "var(--fm-text-secondary)" }}>
                              GSTIN: {c.gstin}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.contract_type === "fixed" && c.fixed_price
                            ? `₹${c.fixed_price} fixed`
                            : c.hourly_rate
                            ? `₹${c.hourly_rate}/hr`
                            : "\u2014"}
                        </TableCell>
                        <TableCell>
                          {c.contract_start && c.contract_end
                            ? `${c.contract_start} → ${c.contract_end}`
                            : c.contract_start || c.contract_end
                            ? c.contract_start || c.contract_end
                            : "\u2014"}
                          {c.payment_terms && (
                            <Typography variant="caption" sx={{ display: "block", color: "var(--fm-text-secondary)" }}>
                              {c.payment_terms}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {score !== undefined ? (
                            <Tooltip title={`${score}% — ${healthLabel(score)}`}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 100 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={score}
                                  sx={{
                                    flex: 1,
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: "var(--fm-bg-secondary)",
                                    "& .MuiLinearProgress-bar": {
                                      borderRadius: 3,
                                      backgroundColor: healthColor(score),
                                    },
                                  }}
                                />
                                <Typography variant="caption" sx={{ fontWeight: 600, color: healthColor(score), minWidth: 28 }}>
                                  {score}%
                                </Typography>
                              </Box>
                            </Tooltip>
                          ) : (
                            "\u2014"
                          )}
                        </TableCell>
                        <TableCell>
                          {projectSummaries[c.id] ? (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {projectSummaries[c.id].count} project{projectSummaries[c.id].count === 1 ? "" : "s"}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: projectSummaries[c.id].profit >= 0 ? "var(--fm-success)" : "var(--fm-danger)" }}
                              >
                                ₹{projectSummaries[c.id].profit.toFixed(2)} profit
                              </Typography>
                            </Box>
                          ) : (
                            "\u2014"
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={c.active ? "success" : "default"}
                            label={c.active ? "Active" : "Inactive"}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(c)}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={c.active ? "Deactivate" : "Activate"}>
                            <IconButton size="small" onClick={() => toggleActive(c)}>
                              {c.active ? (
                                <PauseCircleOutlineIcon fontSize="small" />
                              ) : (
                                <PlayCircleOutlineIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => remove(c.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleFormClose} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "Edit Company" : "Add Company"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Company name *"
              fullWidth
              {...formik.getFieldProps("name")}
              error={formik.touched.name && Boolean(formik.errors.name)}
              helperText={formik.touched.name && formik.errors.name}
            />
            <TextField label="Industry (e.g. Software, Consulting)" fullWidth {...formik.getFieldProps("industry")} />
            <TextField
              label="Contact email"
              fullWidth
              {...formik.getFieldProps("contact_email")}
              error={formik.touched.contact_email && Boolean(formik.errors.contact_email)}
              helperText={formik.touched.contact_email && formik.errors.contact_email}
            />
            <TextField
              label="Contact phone (for WhatsApp)"
              fullWidth
              {...formik.getFieldProps("contact_phone")}
              helperText="With country code if outside India — used for 'Send on WhatsApp'"
              inputProps={{ maxLength: 20 }}
            />
            <TextField label="Notes" fullWidth multiline minRows={2} {...formik.getFieldProps("notes")} />
            <Typography variant="subtitle2" sx={{ mt: 1, color: "var(--fm-text-secondary)" }}>Contract Details</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", minWidth: 90 }}>Rate type</Typography>
              <ToggleButtonGroup
                value={formik.values.contract_type}
                exclusive
                size="small"
                onChange={(_, val) => {
                  if (val !== null) {
                    formik.setFieldValue("contract_type", val);
                    formik.setFieldValue("hourly_rate", "");
                    formik.setFieldValue("fixed_price", "");
                  }
                }}
                sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 2, fontSize: "13px" } }}
              >
                <ToggleButton value="hourly">Hourly</ToggleButton>
                <ToggleButton value="fixed">Fixed Price</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {formik.values.contract_type === "hourly" ? (
              <TextField
                label="Hourly Rate (₹)"
                type="number"
                fullWidth
                size="small"
                {...formik.getFieldProps("hourly_rate")}
                inputProps={{ min: 0, step: 0.5 }}
                error={formik.touched.hourly_rate && Boolean(formik.errors.hourly_rate)}
                helperText={formik.touched.hourly_rate && formik.errors.hourly_rate}
              />
            ) : (
              <TextField
                label="Project Price (₹)"
                type="number"
                fullWidth
                size="small"
                {...formik.getFieldProps("fixed_price")}
                inputProps={{ min: 0, step: 1 }}
                error={formik.touched.fixed_price && Boolean(formik.errors.fixed_price)}
                helperText={formik.touched.fixed_price && formik.errors.fixed_price}
              />
            )}
            <DateField
              label="Contract period"
              value={[formik.values.contract_start, formik.values.contract_end]}
              onChange={([start, end]) => {
                formik.setFieldValue("contract_start", start);
                formik.setFieldValue("contract_end", end);
              }}
              range
              fullWidth
              error={formik.touched.contract_end && Boolean(formik.errors.contract_end)}
              helperText={formik.touched.contract_end && formik.errors.contract_end}
            />
            <TextField label="Payment Terms (e.g. Net 30, Net 15)" fullWidth {...formik.getFieldProps("payment_terms")} />
            <Typography variant="subtitle2" sx={{ mt: 1, color: "var(--fm-text-secondary)" }}>Billing &amp; GST (shown on invoices)</Typography>
            <TextField
              label="Billing address"
              fullWidth
              multiline
              minRows={2}
              {...formik.getFieldProps("billing_address")}
              placeholder="Street, building, area"
            />
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField label="City" fullWidth {...formik.getFieldProps("city")} />
              <TextField label="State" fullWidth {...formik.getFieldProps("state")} />
            </Box>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField
                label="State code (GST)"
                fullWidth
                {...formik.getFieldProps("state_code")}
                helperText="2-digit code, e.g. 29 for Karnataka"
                inputProps={{ maxLength: 2 }}
              />
              <TextField label="PIN" fullWidth {...formik.getFieldProps("pincode")} inputProps={{ maxLength: 6 }} />
            </Box>
            <TextField
              label="GSTIN (client)"
              fullWidth
              {...formik.getFieldProps("gstin")}
              helperText="Leave blank if the client is not GST-registered"
              inputProps={{ maxLength: 15 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleFormClose}>Cancel</Button>
          <Button variant="contained" onClick={formik.handleSubmit} disabled={!formik.isValid}>
            {editing ? "Save" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

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
