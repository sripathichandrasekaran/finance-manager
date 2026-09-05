import React, { useEffect, useState } from "react";
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
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Grid from "@mui/material/Grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LinkIcon from "@mui/icons-material/Link";
import WorkIcon from "@mui/icons-material/Work";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import EmptyState from "../components/EmptyState.jsx";

import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  fetchUnassignedTransactions,
  linkTransactionToProject,
} from "../store/slices/projectsSlice.js";
import { fetchCompanies } from "../store/slices/companiesSlice.js";

const STATUS_COLORS = { active: "success", paused: "warning", completed: "info" };

function pricingLabel(p) {
  if (p.pricing_type === "hourly" && p.hourly_rate) return `₹${p.hourly_rate}/hr`;
  if (p.pricing_type === "fixed" && p.fixed_price != null) return `₹${p.fixed_price} fixed`;
  return "\u2014";
}

export default function Projects() {
  const dispatch = useDispatch();
  const { items, unassigned, total, loading } = useSelector((s) => s.projects);
  const companies = useSelector((s) => s.companies.items);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [linkProject, setLinkProject] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const EMPTY = {
    company_id: "",
    name: "",
    service_sector: "",
    pricing_type: "fixed",
    fixed_price: "",
    hourly_rate: "",
    start_date: "",
    end_date: "",
    status: "active",
    notes: "",
  };

  const formik = useFormik({
    initialValues: EMPTY,
    validationSchema: Yup.object({
      company_id: Yup.string().required("Company is required"),
      name: Yup.string().trim().required("Project name is required"),
      fixed_price: Yup.number().typeError("Enter a valid price").min(0, "Price must be 0 or more"),
      hourly_rate: Yup.number().typeError("Enter a valid rate").min(0, "Rate must be 0 or more"),
      end_date: Yup.date().min(Yup.ref("start_date"), "End date must be after the start date"),
    }),
    onSubmit: async (values) => {
      const payload = {
        ...values,
        company_id: Number(values.company_id),
        fixed_price: values.fixed_price !== "" ? Number(values.fixed_price) : null,
        hourly_rate: values.hourly_rate !== "" ? Number(values.hourly_rate) : null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
      };
      if (editing) {
        await dispatch(updateProject({ id: editing.id, ...payload }));
      } else {
        await dispatch(createProject(payload));
      }
      setDialogOpen(false);
      dispatch(fetchProjects({ page_size: 300 }));
    },
  });

  useEffect(() => {
    dispatch(fetchProjects({ page_size: 300 }));
    dispatch(fetchCompanies({ page_size: 500 }));
  }, [dispatch]);

  const openAdd = () => {
    setEditing(null);
    formik.resetForm();
    formik.setFieldValue("company_id", companies[0]?.id || "");
    formik.setErrors({});
    formik.setTouched({});
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    formik.setValues({
      company_id: p.company_id,
      name: p.name,
      service_sector: p.service_sector || "",
      pricing_type: p.pricing_type || "fixed",
      fixed_price: p.fixed_price ?? "",
      hourly_rate: p.hourly_rate ?? "",
      start_date: p.start_date || "",
      end_date: p.end_date || "",
      status: p.status || "active",
      notes: p.notes || "",
    });
    formik.setErrors({});
    formik.setTouched({});
    setDialogOpen(true);
  };

  const openLink = (p) => {
    setLinkProject(p);
    dispatch(fetchUnassignedTransactions({ company_id: p.company_id }));
  };

  const handleFormClose = () => {
    setDialogOpen(false);
    formik.resetForm();
    formik.setErrors({});
  };

  const remove = async (id) => {
    await dispatch(deleteProject(id));
    dispatch(fetchProjects({ page_size: 300 }));
  };
  const totalIncome = items.reduce((s, p) => s + (p.analytics?.income || 0), 0);
  const totalExpenses = items.reduce((s, p) => s + (p.analytics?.expenses || 0), 0);
  const totalProfit = totalIncome - totalExpenses;
  const activeCount = items.filter((p) => p.active && p.status === "active").length;

  return (
    <Box>
      <PageHeader
        title="Projects"
        description="Individual projects with their own service sector and pricing"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            New Project
          </Button>
        }
      />

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <StatCard title="Projects" value={items.length} currency={false} icon={<WorkIcon />} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Active" value={activeCount} currency={false} icon={<WorkIcon />} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Project Income" value={totalIncome} color="var(--fm-success)" icon={<WorkIcon />} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Project Profit" value={totalProfit} color={totalProfit >= 0 ? "var(--fm-success)" : "var(--fm-danger)"} icon={<WorkIcon />} loading={loading} />
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Project</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Sector</TableCell>
                  <TableCell>Pricing</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Income</TableCell>
                  <TableCell align="right">Expenses</TableCell>
                  <TableCell align="right">Profit</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState icon={<FolderOpenIcon />} title="No projects yet" subtitle="Create a project to track service sector, pricing and profit separately." />
                    </TableCell>
                  </TableRow>
                ) : (
                  items
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                      <TableCell>{p.company_name || p.company_id}</TableCell>
                      <TableCell>{p.service_sector || "\u2014"}</TableCell>
                      <TableCell>{pricingLabel(p)}</TableCell>
                      <TableCell>
                        <Chip size="small" color={STATUS_COLORS[p.status] || "default"} label={p.status || "active"} />
                      </TableCell>
                      <TableCell align="right" sx={{ color: "var(--fm-success)", fontSize: "12px", whiteSpace: "nowrap" }}>
                        ₹{Number(p.analytics?.income || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "var(--fm-danger)", fontSize: "12px", whiteSpace: "nowrap" }}>
                        ₹{Number(p.analytics?.expenses || 0).toFixed(2)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 600,
                          color: (p.analytics?.profit || 0) >= 0 ? "var(--fm-success)" : "var(--fm-danger)",
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ₹{Number(p.analytics?.profit || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Link transactions">
                          <IconButton size="small" onClick={() => openLink(p)}>
                            <LinkIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(p)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => remove(p.id)}>
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={handleFormClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit Project" : "New Project"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              select
              label="Company *"
              fullWidth
              {...formik.getFieldProps("company_id")}
              error={formik.touched.company_id && Boolean(formik.errors.company_id)}
              helperText={formik.touched.company_id && formik.errors.company_id}
            >
              {companies.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Project name *"
              fullWidth
              {...formik.getFieldProps("name")}
              error={formik.touched.name && Boolean(formik.errors.name)}
              helperText={formik.touched.name && formik.errors.name}
            />
            <TextField label="Service sector (e.g. Software, Design, Consulting)" fullWidth {...formik.getFieldProps("service_sector")} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", minWidth: 90 }}>
                Pricing
              </Typography>
              <ToggleButtonGroup
                value={formik.values.pricing_type}
                exclusive
                size="small"
                onChange={(_, val) => {
                  if (val !== null) {
                    formik.setFieldValue("pricing_type", val);
                    formik.setFieldValue("hourly_rate", "");
                    formik.setFieldValue("fixed_price", "");
                  }
                }}
                sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 2, fontSize: "13px" } }}
              >
                <ToggleButton value="fixed">Fixed Price</ToggleButton>
                <ToggleButton value="hourly">Hourly</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {formik.values.pricing_type === "fixed" ? (
              <TextField
                label="Fixed price (₹)"
                type="number"
                fullWidth
                size="small"
                {...formik.getFieldProps("fixed_price")}
                inputProps={{ min: 0 }}
                error={formik.touched.fixed_price && Boolean(formik.errors.fixed_price)}
                helperText={formik.touched.fixed_price && formik.errors.fixed_price}
              />
            ) : (
              <TextField
                label="Hourly rate (₹)"
                type="number"
                fullWidth
                size="small"
                {...formik.getFieldProps("hourly_rate")}
                inputProps={{ min: 0, step: 0.5 }}
                error={formik.touched.hourly_rate && Boolean(formik.errors.hourly_rate)}
                helperText={formik.touched.hourly_rate && formik.errors.hourly_rate}
              />
            )}
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField label="Start date" type="date" fullWidth {...formik.getFieldProps("start_date")} InputLabelProps={{ shrink: true }} />
              <TextField
                label="End date"
                type="date"
                fullWidth
                {...formik.getFieldProps("end_date")}
                InputLabelProps={{ shrink: true }}
                error={formik.touched.end_date && Boolean(formik.errors.end_date)}
                helperText={formik.touched.end_date && formik.errors.end_date}
              />
            </Box>
            <TextField
              select
              label="Status"
              fullWidth
              {...formik.getFieldProps("status")}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="paused">Paused</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </TextField>
            <TextField label="Notes" fullWidth multiline minRows={2} {...formik.getFieldProps("notes")} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleFormClose}>Cancel</Button>
          <Button variant="contained" onClick={formik.handleSubmit} disabled={!formik.isValid}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link transactions dialog */}
      <Dialog open={Boolean(linkProject)} onClose={() => setLinkProject(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Link transactions to "{linkProject?.name}"</DialogTitle>
        <DialogContent>
          {unassigned.length === 0 ? (
            <Typography sx={{ py: 3, textAlign: "center", color: "var(--fm-text-secondary)" }}>
              No unassigned transactions for this company.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {unassigned.map((t) => (
                <Box
                  key={t.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "1px solid var(--fm-border)",
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.description || t.category || "Transaction"}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "var(--fm-text-secondary)" }}>{t.date}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: t.type === "credit" ? "var(--fm-success)" : "var(--fm-danger)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ₹{Number(t.amount).toFixed(2)}
                    </Typography>
                    <Button
                      size="small"
                      onClick={async () => {
                        await dispatch(linkTransactionToProject({ projectId: linkProject.id, txId: t.id }));
                        dispatch(fetchProjects({ page_size: 300 }));
                      }}
                    >
                      Link
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLinkProject(null)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
