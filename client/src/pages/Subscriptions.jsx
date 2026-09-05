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
import TablePagination from "@mui/material/TablePagination";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import EmptyState from "../components/EmptyState.jsx";

import { fetchSubscriptions, createSubscription, updateSubscription, deleteSubscription } from "../store/slices/subscriptionsSlice.js";
import { fetchCompanies } from "../store/slices/companiesSlice.js";
import PageHeader from "../components/PageHeader.jsx";
import { todayISO } from "../utils/timezone.js";

const CYCLES = ["daily", "weekly", "monthly", "yearly"];

export default function Subscriptions() {
  const dispatch = useDispatch();
  const { items, total, loading, error } = useSelector((s) => s.subscriptions);
  const companies = useSelector((s) => s.companies.items);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    billing_cycle: "monthly",
    company_id: "",
    next_billing: todayISO(),
    reminder_days_before: 3,
  });

  useEffect(() => {
    dispatch(fetchSubscriptions(false, { page_size: 300 }));
    dispatch(fetchCompanies({ page_size: 500 }));
  }, [dispatch]);

  const totalAmount = items.reduce((s, x) => s + (x.active ? Number(x.amount) : 0), 0);

  const refetch = () => dispatch(fetchSubscriptions(false, { page_size: 300 }));

  const handleSubmit = async () => {
    if (!form.name || !form.amount || Number(form.amount) <= 0) return;
    const result = await dispatch(
      createSubscription({
        ...form,
        company_id: form.company_id ? Number(form.company_id) : null,
      })
    );
    if (!result.error) {
      setDialogOpen(false);
      setForm({ ...form, name: "", amount: "" });
      refetch();
    }
  };

  const toggleActive = (sub) => dispatch(updateSubscription({ id: sub.id, active: !sub.active })).then(refetch);
  const togglePaid = (sub) => dispatch(updateSubscription({ id: sub.id, paid: !sub.paid })).then(refetch);
  const remove = (id) => dispatch(deleteSubscription(id)).then(refetch);

  return (
    <Box>
      <PageHeader
        title="Subscriptions"
        description={`Recurring payments \u2022 Monthly total: ₹${totalAmount.toFixed(2)}`}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Add Subscription
          </Button>
        }
      />

      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Cycle</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Next billing</TableCell>
                  <TableCell align="center">Paid</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Status / Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState icon={<AutorenewIcon />} title="No subscriptions yet" subtitle="Track recurring bills to stay on top of your monthly spend." />
                    </TableCell>
                  </TableRow>
                ) : (
                  items
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                      <TableCell>
                        <Chip label={s.billing_cycle} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {s.company_id ? (
                          <Chip
                            label={companies.find((c) => c.id === s.company_id)?.name || "\u2014"}
                            size="small"
                          />
                        ) : (
                          "\u2014"
                        )}
                      </TableCell>
                      <TableCell>Next: {s.next_billing}</TableCell>
                      <TableCell align="center">
                        <Tooltip title={s.paid ? "Mark unpaid" : "Mark as paid"}>
                          <Checkbox
                            checked={!!s.paid}
                            disabled={!s.active}
                            color="success"
                            onChange={() => togglePaid(s)}
                            size="small"
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        ₹{Number(s.amount).toFixed(2)}/mo
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          color={s.active ? "success" : "default"}
                          label={s.active ? "Active" : "Paused"}
                          sx={{ mr: 1 }}
                        />
                        <Tooltip title={s.active ? "Pause" : "Activate"}>
                          <IconButton size="small" onClick={() => toggleActive(s)}>
                            {s.active ? (
                              <PauseCircleOutlineIcon fontSize="small" />
                            ) : (
                              <PlayCircleOutlineIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => remove(s.id)}>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Subscription</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{typeof error === 'string' ? error : 'An error occurred'}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Name (e.g. Netflix)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Amount (₹)"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <TextField
              select
              label="Billing cycle"
              value={form.billing_cycle}
              onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })}
            >
              {CYCLES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Company (optional)"
              value={form.company_id}
              onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {companies.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Next billing"
              type="date"
              value={form.next_billing}
              onChange={(e) => setForm({ ...form, next_billing: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Remind days before"
              type="number"
              value={form.reminder_days_before}
              onChange={(e) => setForm({ ...form, reminder_days_before: Number(e.target.value) })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.name || !form.amount}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
