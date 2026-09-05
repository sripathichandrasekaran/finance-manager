import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
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
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TimerIcon from "@mui/icons-material/Timer";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ListAltIcon from "@mui/icons-material/ListAlt";
import EmptyState from "../components/EmptyState.jsx";

import {
  fetchTimeEntries,
  createTimeEntry,
  deleteTimeEntry,
  fetchTimeSummary,
} from "../store/slices/timeEntriesSlice.js";
import { fetchCompanies } from "../store/slices/companiesSlice.js";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import { todayISO } from "../utils/timezone.js";

export default function TimeTracking() {
  const dispatch = useDispatch();
  const { items, total, loading, error, summary } = useSelector((s) => s.timeEntries);
  const companies = useSelector((s) => s.companies.items);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [form, setForm] = useState({
    company_id: "",
    description: "",
    hours: "",
    hourly_rate: "",
    date: todayISO(),
  });

  useEffect(() => {
    dispatch(fetchTimeEntries({ page: page + 1, page_size: rowsPerPage }));
    dispatch(fetchTimeSummary());
    dispatch(fetchCompanies({ page_size: 500 }));
  }, [dispatch, page, rowsPerPage]);

  const totals = useMemo(() => {
    const totalHours = Number(summary?.total_hours ?? 0);
    const totalEarnings = Number(summary?.total_earned ?? 0);
    const avgRate = totalHours > 0 ? totalEarnings / totalHours : 0;
    return { totalHours, totalEarnings, avgRate, count: Number(summary?.entry_count ?? 0) };
  }, [summary]);

  useEffect(() => {
    if (!loading && items.length === 0 && total > 0) setPage(0);
  }, [items.length, total, loading]);

  const handleSubmit = async () => {
    if (!form.hours || Number(form.hours) <= 0 || !form.hourly_rate || Number(form.hourly_rate) <= 0) return;
    const payload = {
      ...form,
      company_id: form.company_id ? Number(form.company_id) : null,
      hours: Number(form.hours),
      hourly_rate: Number(form.hourly_rate),
    };
    const result = await dispatch(createTimeEntry(payload));
    if (!result.error) {
      setDialogOpen(false);
      setForm({ ...form, hours: "", hourly_rate: "", description: "" });
      dispatch(fetchTimeEntries({ page: page + 1, page_size: rowsPerPage }));
      dispatch(fetchTimeSummary());
    }
  };

  const handleDelete = async (id) => {
    const result = await dispatch(deleteTimeEntry(id));
    if (!result.error) {
      dispatch(fetchTimeEntries({ page: page + 1, page_size: rowsPerPage }));
      dispatch(fetchTimeSummary());
    }
  };

  const companyName = (id) => companies.find((c) => c.id === id)?.name || "";

  return (
    <Box>
      <PageHeader
        title="Time Tracking"
        description="Track billable hours and earnings"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Add Entry
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Total Hours"
            value={totals.totalHours.toFixed(1)}
            currency={false}
            color="var(--fm-text-primary)"
            icon={<TimerIcon />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Total Earnings"
            value={totals.totalEarnings}
            color="var(--fm-success)"
            icon={<AttachMoneyIcon />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Avg Rate"
            value={totals.avgRate}
            color="var(--fm-text-primary)"
            icon={<TrendingUpIcon />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Entries"
            value={totals.count}
            currency={false}
            color="var(--fm-text-primary)"
            icon={<ListAltIcon />}
            loading={loading}
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Hours</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Earnings</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: "var(--fm-text-secondary)" }}>
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState icon={<AccessTimeIcon />} title="No time entries yet" subtitle="Start logging your billable hours." />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((entry) => {
                      const earnings = Number(entry.hours || 0) * Number(entry.hourly_rate || 0);
                      return (
                        <TableRow key={entry.id} hover>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{entry.date}</TableCell>
                          <TableCell>
                            {entry.company_id ? (
                              <Chip label={companyName(entry.company_id)} size="small" />
                            ) : (
                              "\u2014"
                            )}
                          </TableCell>
                          <TableCell>{entry.description || "\u2014"}</TableCell>
                          <TableCell align="right">{Number(entry.hours).toFixed(1)}</TableCell>
                          <TableCell align="right">₹{Number(entry.hourly_rate).toFixed(2)}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--fm-success)" }}>
                              ₹{earnings.toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleDelete(entry.id)} color="error">
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Time Entry</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {error && <Alert severity="error">{typeof error === 'string' ? error : 'An error occurred'}</Alert>}
            <TextField
              select
              label="Company"
              value={form.company_id}
              onChange={(e) => setForm({ ...form, company_id: e.target.value })}
              size="small"
              fullWidth
            >
              <MenuItem value="">None</MenuItem>
              {companies.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              size="small"
              fullWidth
            />
            <TextField
              label="Hours"
              type="number"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              inputProps={{ min: 0, step: 0.25 }}
              size="small"
              fullWidth
            />
            <TextField
              label="Hourly Rate (₹)"
              type="number"
              value={form.hourly_rate}
              onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
              inputProps={{ min: 0, step: 0.5 }}
              size="small"
              fullWidth
            />
            <TextField
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!form.hours || Number(form.hours) <= 0 || !form.hourly_rate || Number(form.hourly_rate) <= 0}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
