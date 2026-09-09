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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import DoneIcon from "@mui/icons-material/Done";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import EmptyState from "../components/EmptyState.jsx";

import { fetchReminders, dismissReminder, deleteReminder, createReminder } from "../store/slices/remindersSlice.js";
import PageHeader from "../components/PageHeader.jsx";
import { todayISO } from "../utils/timezone.js";

const STATUS_COLORS = { pending: "warning", timed_out: "default", dismissed: "success" };

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function Reminders() {
  const dispatch = useDispatch();
  const { items, total, error } = useSelector((s) => s.reminders);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);

  const formik = useFormik({
    initialValues: {
      title: "",
      message: "",
      trigger_date: todayISO(),
      trigger_time: "",
    },
    validationSchema: Yup.object({
      title: Yup.string().required("Title is required"),
      trigger_date: Yup.date().required("Date is required"),
    }),
    onSubmit: async (values, { resetForm }) => {
      const payload = {
        title: values.title,
        message: values.message || null,
        trigger_date: values.trigger_date,
        trigger_time: values.trigger_time || null,
      };
      const result = await dispatch(createReminder(payload));
      if (!result.error) {
        setDialogOpen(false);
        resetForm();
        dispatch(fetchReminders({ page_size: 300 }));
      }
    },
  });

  useEffect(() => {
    dispatch(fetchReminders({ page_size: 300 }));
  }, [dispatch]);

  const totalPending = items.filter((r) => r.status === "pending").length;

  useEffect(() => {
    if (page > 0 && page * rowsPerPage >= total) setPage(0);
  }, [total, page, rowsPerPage]);

  return (
    <Box>
      <PageHeader
        title="Reminders"
        description="Upcoming subscription and daily notifications"
        actions={
          <>
            <Chip
              size="small"
              label={`${totalPending} pending`}
              color={totalPending ? "warning" : "success"}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              Create Reminder
            </Button>
          </>
        }
      />

      {items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={<NotificationsNoneIcon />} title="No reminders yet" subtitle="The scheduler checks every 15 minutes and generates reminders for upcoming subscriptions and a daily summary." />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Trigger</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Chip label={r.type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.title}</TableCell>
                      <TableCell>{r.message}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{r.trigger_date}{r.trigger_time ? ` at ${formatTime(r.trigger_time)}` : ""}</TableCell>
                      <TableCell>
                        <Chip
                          label={r.status}
                          size="small"
                          color={STATUS_COLORS[r.status] || "default"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {r.status === "pending" && (
                          <Tooltip title="Dismiss">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() =>
                              dispatch(dismissReminder(r.id)).then(() => dispatch(fetchReminders({ page_size: 300 })))
                            }
                            >
                              <DoneIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                            dispatch(deleteReminder(r.id)).then(() => dispatch(fetchReminders({ page_size: 300 })))
                          }
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
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
      )}

      <Box sx={{ mt: 2 }}>
        <Button size="small" onClick={() => dispatch(fetchReminders({ page_size: 300 }))}>
          Refresh
        </Button>
      </Box>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); formik.resetForm(); }} maxWidth="xs" fullWidth>
        <DialogTitle>Create Reminder</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {error && <Alert severity="error">{typeof error === 'string' ? error : 'An error occurred'}</Alert>}
            <TextField
              label="Title"
              {...formik.getFieldProps("title")}
              size="small"
              fullWidth
              error={formik.touched.title && Boolean(formik.errors.title)}
              helperText={formik.touched.title && formik.errors.title}
            />
            <TextField
              label="Message (optional)"
              {...formik.getFieldProps("message")}
              size="small"
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Date"
              type="date"
              {...formik.getFieldProps("trigger_date")}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              error={formik.touched.trigger_date && Boolean(formik.errors.trigger_date)}
              helperText={formik.touched.trigger_date && formik.errors.trigger_date}
            />
            <TextField
              label="Time (optional)"
              type="time"
              {...formik.getFieldProps("trigger_time")}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setDialogOpen(false); formik.resetForm(); }}>Cancel</Button>
          <Button variant="contained" onClick={formik.handleSubmit} disabled={!formik.isValid || formik.isSubmitting}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
