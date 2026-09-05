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
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DoneIcon from "@mui/icons-material/Done";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import EmptyState from "../components/EmptyState.jsx";

import { fetchReminders, dismissReminder, deleteReminder } from "../store/slices/remindersSlice.js";
import PageHeader from "../components/PageHeader.jsx";

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
  const { items, total } = useSelector((s) => s.reminders);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
          <Chip
            size="small"
            label={`${totalPending} pending`}
            color={totalPending ? "warning" : "success"}
          />
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
    </Box>
  );
}
