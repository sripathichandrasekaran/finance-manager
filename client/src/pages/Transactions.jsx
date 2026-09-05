import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
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
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import EmptyState from "../components/EmptyState.jsx";

import { fetchTransactions, createTransaction, deleteTransaction } from "../store/slices/transactionsSlice.js";
import { fetchStats } from "../store/slices/dashboardSlice.js";
import { fetchCompanies } from "../store/slices/companiesSlice.js";
import { fetchProjects } from "../store/slices/projectsSlice.js";
import PageHeader from "../components/PageHeader.jsx";
import { todayISO } from "../utils/timezone.js";

const DEFAULT_CATEGORIES = [
  "Food", "Transport", "Bills", "Shopping", "Entertainment", "Health",
  "Education", "Rent", "Subscriptions", "Salary", "Investment", "Other",
];

export default function Transactions() {
  const dispatch = useDispatch();
  const { items, total, loading, error } = useSelector((s) => s.transactions);
  const categories = useSelector((s) => (s.dashboard.stats?.categories || []).map((c) => c.name));
  const companies = useSelector((s) => s.companies.items);
  const projects = useSelector((s) => s.projects.items);
  const activeCategories = categories.length ? categories : DEFAULT_CATEGORIES;
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const formik = useFormik({
initialValues: {
        amount: "",
        type: "debit",
        category: "Food",
        company_id: "",
        project_id: "",
        description: "",
        date: todayISO(),
      },
    validationSchema: Yup.object({
      amount: Yup.number()
        .typeError("Enter a valid amount")
        .positive("Amount must be greater than 0")
        .required("Amount is required"),
    }),
    onSubmit: async (values) => {
      const payload = {
        ...values,
        company_id: values.company_id ? Number(values.company_id) : null,
        project_id: values.project_id ? Number(values.project_id) : null,
      };
      const result = await dispatch(createTransaction(payload));
      if (!result.error) {
        setDialogOpen(false);
        formik.resetForm();
        dispatch(fetchTransactions({ page: page + 1, page_size: rowsPerPage }));
        dispatch(fetchStats());
      }
    },
  });

  useEffect(() => {
    dispatch(fetchTransactions({ page: page + 1, page_size: rowsPerPage }));
    dispatch(fetchStats());
    dispatch(fetchCompanies({ page_size: 500 }));
    dispatch(fetchProjects({ page_size: 500 }));
  }, [dispatch, page, rowsPerPage]);

  useEffect(() => {
    if (!loading && items.length === 0 && total > 0) setPage(0);
  }, [items.length, total, loading]);

  const handleDelete = async (id) => {
    const result = await dispatch(deleteTransaction(id));
    if (!result.error) {
      dispatch(fetchStats());
      dispatch(fetchTransactions({ page: page + 1, page_size: rowsPerPage }));
    }
  };

  const handleFormClose = () => {
    setDialogOpen(false);
    formik.resetForm();
    formik.setErrors({});
  };

  const companyName = (id) => companies.find((c) => c.id === id)?.name || "";
  const projectName = (id) => projects.find((p) => p.id === id)?.name || "";

  return (
    <Box>
      <PageHeader
        title="Transactions"
        description="Every credit and debit"
        actions={
          <>
            <Button variant="outlined" startIcon={<SmartToyIcon />} onClick={() => navigate("/ai")}>
              AI Add
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              Add Transaction
            </Button>
          </>
        }
      />

      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell align="right">Amount</TableCell>
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
                      <EmptyState icon={<ReceiptLongIcon />} title="No transactions yet" subtitle="Add a transaction to start tracking income and expenses." />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((t) => (
                      <TableRow key={t.id} hover>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{t.date}</TableCell>
                        <TableCell>
                          {t.description || "\u2014"}
                          {t.is_ai_categorized && (
                            <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                              AI
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={t.category || "Other"} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {t.company_id ? (
                            <Chip label={companyName(t.company_id)} size="small" color="default" />
                          ) : (
                            "\u2014"
                          )}
                        </TableCell>
                        <TableCell>
                          {t.project_id ? (
                            <Chip label={projectName(t.project_id)} size="small" variant="outlined" />
                          ) : (
                            "\u2014"
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: t.type === "credit" ? "var(--fm-success)" : "var(--fm-danger)",
                            }}
                          >
                            {t.type === "credit" ? "+" : "\u2212"}₹{Number(t.amount).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => handleDelete(t.id)} color="error">
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

      <Dialog open={dialogOpen} onClose={handleFormClose} maxWidth="xs" fullWidth>
        <DialogTitle>Add Transaction</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {error && <Alert severity="error">{typeof error === 'string' ? error : 'An error occurred'}</Alert>}
            <TextField
              select
              label="Type"
              {...formik.getFieldProps("type")}
              size="small"
              fullWidth
            >
              <MenuItem value="debit">Debit (Spend)</MenuItem>
              <MenuItem value="credit">Credit (Income)</MenuItem>
            </TextField>
            <TextField
              label="Amount (₹)"
              type="number"
              {...formik.getFieldProps("amount")}
              size="small"
              fullWidth
              error={formik.touched.amount && Boolean(formik.errors.amount)}
              helperText={formik.touched.amount && formik.errors.amount}
            />
            <TextField
              select
              label="Category"
              {...formik.getFieldProps("category")}
              size="small"
              fullWidth
            >
              {activeCategories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Company (optional)"
              {...formik.getFieldProps("company_id")}
              onChange={(e) => {
                formik.setFieldValue("company_id", e.target.value);
                formik.setFieldValue("project_id", "");
              }}
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
              select
              label="Project (optional)"
              {...formik.getFieldProps("project_id")}
              size="small"
              fullWidth
              disabled={!formik.values.company_id}
            >
              <MenuItem value="">None</MenuItem>
              {projects
                .filter((p) => !formik.values.company_id || p.company_id === Number(formik.values.company_id))
                .map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Description"
              {...formik.getFieldProps("description")}
              size="small"
              fullWidth
            />
            <TextField
              label="Date"
              type="date"
              {...formik.getFieldProps("date")}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleFormClose}>Cancel</Button>
          <Button variant="contained" onClick={formik.handleSubmit} disabled={!formik.isValid}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
