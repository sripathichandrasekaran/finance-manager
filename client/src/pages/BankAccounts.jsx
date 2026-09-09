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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";

import { fetchBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } from "../store/slices/bankAccountSlice.js";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit_card", label: "Credit Card" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
];

const EMPTY = {
  name: "",
  type: "checking",
  bank_name: "",
  account_number: "",
  iban: "",
  swift_bic: "",
  currency: "INR",
  balance: 0,
  is_active: true,
  notes: "",
};

export default function BankAccounts() {
  const dispatch = useDispatch();
  const { items, total, loading, error } = useSelector((s) => s.bankAccounts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const formik = useFormik({
    initialValues: EMPTY,
    validationSchema: Yup.object({
      name: Yup.string().trim().required("Account name is required"),
      type: Yup.string().required("Account type is required"),
      currency: Yup.string().required("Currency is required"),
    }),
    onSubmit: async (values) => {
      const payload = { ...values, balance: Number(values.balance) || 0 };
      if (editing) {
        await dispatch(updateBankAccount({ id: editing.id, ...payload }));
      } else {
        await dispatch(createBankAccount(payload));
      }
      setDialogOpen(false);
      formik.resetForm();
      dispatch(fetchBankAccounts({ page: page + 1, page_size: rowsPerPage }));
    },
  });

  useEffect(() => {
    dispatch(fetchBankAccounts({ page: page + 1, page_size: rowsPerPage }));
  }, [dispatch, page, rowsPerPage]);

  useEffect(() => {
    if (!loading && items.length === 0 && total > 0) setPage(0);
  }, [items.length, total, loading]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this bank account? Linked transactions will become unassigned.")) return;
    const result = await dispatch(deleteBankAccount(id));
    if (!result.error) {
      dispatch(fetchBankAccounts({ page: page + 1, page_size: rowsPerPage }));
    }
  };

  const handleFormClose = () => {
    setDialogOpen(false);
    setEditing(null);
    formik.resetForm();
    formik.setErrors({});
    formik.setTouched({});
  };

  const openAdd = () => {
    setEditing(null);
    formik.resetForm();
    formik.setErrors({});
    formik.setTouched({});
    setDialogOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    formik.setValues({
      name: a.name,
      type: a.type,
      bank_name: a.bank_name || "",
      account_number: a.account_number || "",
      iban: a.iban || "",
      swift_bic: a.swift_bic || "",
      currency: a.currency,
      balance: a.balance,
      is_active: a.is_active,
      notes: a.notes || "",
    });
    formik.setErrors({});
    formik.setTouched({});
    setDialogOpen(true);
  };

  const typeLabel = (t) => ACCOUNT_TYPES.find((x) => x.value === t)?.label || t;

  return (
    <Box>
      <PageHeader
        title="Bank Accounts"
        description="Track your bank accounts, cards, and cash wallets"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            Add Account
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
                  <TableCell>Type</TableCell>
                  <TableCell>Bank</TableCell>
                  <TableCell>Currency</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell>Status</TableCell>
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
                      <EmptyState icon={<AccountBalanceWalletIcon />} title="No bank accounts yet" subtitle="Add a bank account to organize transactions by account." />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((a) => (
                    <TableRow key={a.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name}</Typography>
                        {a.account_number && (
                          <Typography variant="caption" color="textSecondary">
                            •••• {a.account_number.slice(-4)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={typeLabel(a.type)} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{a.bank_name || "—"}</TableCell>
                      <TableCell>{a.currency}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ₹{Number(a.balance).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={a.is_active ? "Active" : "Inactive"} size="small" color={a.is_active ? "success" : "default"} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(a)} color="primary">
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDelete(a.id)} color="error">
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleFormClose} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {error && <Typography color="error">{typeof error === 'string' ? error : 'An error occurred'}</Typography>}
            <TextField
              label="Account Name"
              {...formik.getFieldProps("name")}
              error={formik.touched.name && Boolean(formik.errors.name)}
              helperText={formik.touched.name && formik.errors.name}
              fullWidth
            />
            <TextField
              select
              label="Account Type"
              {...formik.getFieldProps("type")}
              fullWidth
            >
              {ACCOUNT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Bank Name (optional)"
              {...formik.getFieldProps("bank_name")}
              fullWidth
            />
            <TextField
              label="Account Number (optional)"
              {...formik.getFieldProps("account_number")}
              fullWidth
            />
            <TextField
              label="IBAN (optional)"
              {...formik.getFieldProps("iban")}
              fullWidth
            />
            <TextField
              label="SWIFT/BIC (optional)"
              {...formik.getFieldProps("swift_bic")}
              fullWidth
            />
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField
                select
                label="Currency"
                {...formik.getFieldProps("currency")}
                fullWidth
              >
                <MenuItem value="INR">INR (₹)</MenuItem>
                <MenuItem value="USD">USD ($)</MenuItem>
                <MenuItem value="EUR">EUR (€)</MenuItem>
                <MenuItem value="GBP">GBP (£)</MenuItem>
              </TextField>
              <TextField
                type="number"
                label="Current Balance"
                {...formik.getFieldProps("balance")}
                fullWidth
                inputProps={{ step: 0.01 }}
              />
            </Box>
            <TextField
              label="Notes"
              multiline
              minRows={2}
              {...formik.getFieldProps("notes")}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleFormClose}>Cancel</Button>
          <Button variant="contained" onClick={formik.handleSubmit} disabled={!formik.isValid}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}