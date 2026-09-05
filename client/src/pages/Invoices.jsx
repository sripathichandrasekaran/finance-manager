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
import Menu from "@mui/material/Menu";
import Grid from "@mui/material/Grid";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PrintIcon from "@mui/icons-material/PrintOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import TableChartIcon from "@mui/icons-material/TableChart";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import HistoryIcon from "@mui/icons-material/History";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import EmptyState from "../components/EmptyState.jsx";
import api from "../services/api.js";

import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import InvoicePreview from "../components/InvoicePreview.jsx";
import {
  fetchInvoices,
  createInvoice,
  updateInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  recordPayment,
  fetchRecurringInvoices,
  createRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  generateRecurringInvoice,
} from "../store/slices/invoicesSlice.js";
import { fetchCompanies } from "../store/slices/companiesSlice.js";
import { fetchProjects } from "../store/slices/projectsSlice.js";

const STATUS_COLORS = {
  draft: "default",
  sent: "info",
  paid: "success",
  overdue: "error",
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

const BILLING_CYCLES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function invoiceTotals(fields) {
  const subtotal = (fields.items || []).reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );
  const taxRate = Number(fields.tax_rate) || 0;
  const tax = (subtotal * taxRate) / 100;
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

export default function Invoices() {
  const dispatch = useDispatch();
  const { items, loading, recurringItems, recurringLoading } = useSelector((s) => s.invoices);
  const companies = useSelector((s) => s.companies.items);
  const projects = useSelector((s) => s.projects.items);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusMenu, setStatusMenu] = useState(null); // { anchorEl, invoice }
  const [payDialog, setPayDialog] = useState(null); // invoice to record payment on
  const [preview, setPreview] = useState(null); // invoice to preview
  const [seller, setSeller] = useState(null); // business-profile for the From block
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tab, setTab] = useState("regular");
  const [recOpen, setRecOpen] = useState(false);
  const [recEditing, setRecEditing] = useState(null);

  const EMPTY = {
    invoice_number: "",
    company_id: "",
    project_id: "",
    issue_date: "",
    due_date: "",
    status: "draft",
    tax_rate: "",
    tax_type: "",
    paid_amount: "",
    notes: "",
    items: [{ description: "", quantity: 1, unit_price: "", hsn_sac: "", tax_rate: "" }],
  };

  const formik = useFormik({
    initialValues: EMPTY,
    validationSchema: Yup.object({
      invoice_number: Yup.string().trim().required("Invoice number is required"),
      company_id: Yup.string().required("Company is required"),
      items: Yup.array().of(
        Yup.object({
          description: Yup.string().trim().required("Description is required"),
          quantity: Yup.number().typeError("Invalid").min(0),
          unit_price: Yup.number().typeError("Invalid").min(0),
        })
      ),
    }),
    onSubmit: async (values) => {
      const taxType = values.tax_type;
      const itemsPayload = values.items
        .filter((it) => it.description.trim())
        .map((it) => {
          const rate = Number(it.tax_rate) || 0;
          let cgst_rate = 0;
          let sgst_rate = 0;
          let igst_rate = 0;
          if (rate > 0 && taxType) {
            if (taxType === "igst") igst_rate = rate;
            else {
              const half = rate / 2;
              cgst_rate = half;
              sgst_rate = half;
            }
          }
          return {
            description: it.description.trim(),
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            hsn_sac: (it.hsn_sac || "").trim() || null,
            tax_rate: rate,
            cgst_rate,
            sgst_rate,
            igst_rate,
          };
        });
      const payload = {
        ...values,
        company_id: Number(values.company_id),
        project_id: values.project_id ? Number(values.project_id) : null,
        tax_rate: Number(values.tax_rate) || 0,
        tax_type: taxType || null,
        paid_amount: Number(values.paid_amount) || 0,
        issue_date: values.issue_date || null,
        due_date: values.due_date || null,
        items: itemsPayload,
      };
      delete payload.touched;
      delete payload.errors;
      if (editing) {
        await dispatch(updateInvoice({ id: editing.id, ...payload }));
      } else {
        await dispatch(createInvoice(payload));
      }
      setDialogOpen(false);
      dispatch(fetchInvoices({ page_size: 300 }));
    },
  });

  useEffect(() => {
    dispatch(fetchInvoices({ page_size: 300 }));
    dispatch(fetchCompanies({ page_size: 500 }));
    dispatch(fetchProjects({ active: true, page_size: 500 }));
    api.get("/business-profile").then(({ data }) => setSeller(data)).catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    if (tab === "recurring") dispatch(fetchRecurringInvoices({ page_size: 500 }));
  }, [tab, dispatch]);

  const REC_EMPTY = {
    name: "",
    company_id: "",
    project_id: "",
    billing_cycle: "monthly",
    next_generation: "",
    tax_rate: "",
    auto_send: false,
    active: true,
    notes: "",
    items: [{ description: "", quantity: 1, unit_price: "" }],
  };

  const recFormik = useFormik({
    initialValues: REC_EMPTY,
    validationSchema: Yup.object({
      name: Yup.string().trim().required("Name is required"),
      company_id: Yup.string().required("Company is required"),
      billing_cycle: Yup.string().required("Billing cycle is required"),
      items: Yup.array().of(
        Yup.object({
          description: Yup.string().trim().required("Description is required"),
          quantity: Yup.number().typeError("Invalid").min(0),
          unit_price: Yup.number().typeError("Invalid").min(0),
        })
      ),
    }),
    onSubmit: async (values) => {
      const itemsPayload = values.items
        .filter((it) => it.description.trim())
        .map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
        }));
      const payload = {
        name: values.name.trim(),
        company_id: Number(values.company_id),
        project_id: values.project_id ? Number(values.project_id) : null,
        billing_cycle: values.billing_cycle,
        next_generation: values.next_generation || null,
        tax_rate: Number(values.tax_rate) || 0,
        auto_send: Boolean(values.auto_send),
        active: Boolean(values.active),
        notes: values.notes,
        items: itemsPayload,
      };
      if (recEditing) {
        await dispatch(updateRecurringInvoice({ id: recEditing.id, ...payload }));
      } else {
        await dispatch(createRecurringInvoice(payload));
      }
      setRecOpen(false);
      recFormik.resetForm();
      dispatch(fetchRecurringInvoices({ page_size: 500 }));
    },
  });

  const recTotals = (() => {
    const subtotal = (recFormik.values.items || []).reduce(
      (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      0
    );
    const tax = (subtotal * (Number(recFormik.values.tax_rate) || 0)) / 100;
    return { subtotal, tax, total: subtotal + tax };
  })();

  const openRecAdd = () => {
    setRecEditing(null);
    recFormik.resetForm();
    recFormik.setFieldValue("company_id", companies[0]?.id || "");
    recFormik.setFieldValue("items", [{ description: "", quantity: 1, unit_price: "" }]);
    recFormik.setErrors({});
    recFormik.setTouched({});
    setRecOpen(true);
  };

  const openRecEdit = (r) => {
    setRecEditing(r);
    recFormik.setValues({
      name: r.name || "",
      company_id: r.company_id || "",
      project_id: r.project_id != null ? r.project_id : "",
      billing_cycle: r.billing_cycle || "monthly",
      next_generation: r.next_generation || "",
      tax_rate: r.tax_rate ?? "",
      auto_send: Boolean(r.auto_send),
      active: r.active !== false,
      notes: r.notes || "",
      items:
        r.items && r.items.length
          ? r.items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unit_price,
            }))
          : [{ description: "", quantity: 1, unit_price: "" }],
    });
    recFormik.setErrors({});
    recFormik.setTouched({});
    setRecOpen(true);
  };

  const recGenerate = async (r) => {
    await dispatch(generateRecurringInvoice(r.id));
    dispatch(fetchInvoices({ page_size: 300 }));
  };

  const recToggle = async (r) => {
    await dispatch(updateRecurringInvoice({ id: r.id, active: !r.active }));
  };

  const recDelete = async (r) => {
    await dispatch(deleteRecurringInvoice(r.id));
  };

  const openAdd = () => {
    setEditing(null);
    formik.resetForm();
    formik.setFieldValue("status", "draft");
    formik.setFieldValue("invoice_number", nextInvoiceNumber());
    formik.setFieldValue("company_id", companies[0]?.id || "");
    formik.setFieldValue("items", [{ description: "", quantity: 1, unit_price: "", hsn_sac: "", tax_rate: "" }]);
    formik.setErrors({});
    formik.setTouched({});
    setDialogOpen(true);
  };

  const openEdit = (inv) => {
    setEditing(inv);
    formik.setValues({
      invoice_number: inv.invoice_number,
      company_id: inv.company_id,
      project_id: inv.project_id != null ? inv.project_id : "",
      issue_date: inv.issue_date || "",
      due_date: inv.due_date || "",
      status: inv.status || "draft",
      tax_rate: inv.tax_rate ?? "",
      tax_type: inv.tax_type || "",
      paid_amount: inv.paid_amount ?? "",
      notes: inv.notes || "",
      items:
        inv.items && inv.items.length
          ? inv.items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unit_price,
              hsn_sac: it.hsn_sac || "",
              tax_rate: it.tax_rate ?? "",
            }))
          : [{ description: "", quantity: 1, unit_price: "", hsn_sac: "", tax_rate: "" }],
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

  const remove = async (id) => {
    await dispatch(deleteInvoice(id));
    dispatch(fetchInvoices({ page_size: 300 }));
  };

  const printInvoice = async (inv) => {
    try {
      const { data } = await api.get(`/invoices/${inv.id}/print`, { responseType: "text" });
      const win = window.open("", "_blank");
      win.document.write(data);
      win.document.close();
    } catch {
      window.alert("Could not open invoice for printing.");
    }
  };

  const nextInvoiceNumber = () => {
    const count = items.length;
    const now = new Date();
    return `INV-${now.getFullYear()}-${String(count + 1).padStart(3, "0")}`;
  };

  const filtered = statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter);
  const totalOutstanding = items.reduce((s, i) => s + (i.balance_due || 0), 0);
  const totalPaid = items.reduce((s, i) => s + (i.paid_amount || 0), 0);
  const totalBilled = items.reduce((s, i) => s + (i.total || 0), 0);
  const overdueCount = items.filter((i) => i.status === "overdue").length;

  const handleStatusAction = async (status, paid) => {
    const inv = statusMenu?.invoice;
    if (paid !== undefined && paid !== null && status === "paid") {
      setPayDialog({ invoice: inv, amount: paid });
      setStatusMenu(null);
      return;
    }
    await dispatch(updateInvoiceStatus({ id: inv.id, status, ...(paid !== undefined ? { paid_amount: paid } : {}) }));
    setStatusMenu(null);
  };

  const handleRecordPayment = async (inv, amount) => {
    await dispatch(recordPayment({
      invoiceId: inv.id,
      amount: Number(amount),
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "Other",
      reference: "",
      notes: `Payment recorded via UI`
    }));
    dispatch(fetchInvoices({ page_size: 300 }));
  };

  return (
    <Box>
      <PageHeader
        title="Invoices"
        description="Bill companies for work delivered and track payments"
        actions={
          <Button
            variant="contained"
            startIcon={tab === "recurring" ? <AutorenewIcon /> : <AddIcon />}
            onClick={tab === "recurring" ? openRecAdd : openAdd}
          >
            {tab === "recurring" ? "New Recurring" : "New Invoice"}
          </Button>
        }
      />

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2, minHeight: 40 }}>
        <Tab value="regular" label="Invoices" icon={<TableChartIcon />} iconPosition="start" sx={{ minHeight: 40 }} />
        <Tab value="recurring" label="Recurring" icon={<AutorenewIcon />} iconPosition="start" sx={{ minHeight: 40 }} />
      </Tabs>

      {tab === "regular" && (
      <>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <StatCard title="Total Billed" value={totalBilled} color="var(--fm-primary)" icon={<ReceiptLongIcon />} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Outstanding" value={totalOutstanding} color="var(--fm-warning)" icon={<AccountBalanceWalletIcon />} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Received" value={totalPaid} color="var(--fm-success)" icon={<PaidOutlinedIcon />} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Overdue" value={overdueCount} currency={false} color={overdueCount > 0 ? "var(--fm-danger)" : "var(--fm-success)"} icon={<SendOutlinedIcon />} loading={loading} />
        </Grid>
      </Grid>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All</MenuItem>
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
      </Box>
      </>
      )}

      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {tab === "regular" ? (
          <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        icon={<ReceiptLongIcon />}
                        title={statusFilter !== "all" ? `No invoices with status "${statusFilter}"` : "No invoices yet"}
                        subtitle="Create an invoice to bill a company."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((inv) => (
                    <TableRow key={inv.id} hover>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{inv.invoice_number}</TableCell>
                      <TableCell>
                        {inv.company_name || inv.company_id}
                        {inv.project_name ? (
                          <Typography variant="caption" display="block" sx={{ color: "var(--fm-text-secondary)", fontSize: "11px" }}>
                            {inv.project_name}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{inv.due_date || "\u2014"}</TableCell>
                      <TableCell>
                        <Chip size="small" color={STATUS_COLORS[inv.status] || "default"} label={inv.status || "draft"} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        ₹{Number(inv.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "var(--fm-success)", fontSize: "12px", whiteSpace: "nowrap" }}>
                        ₹{Number(inv.paid_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 600,
                          color: (inv.balance_due || 0) > 0 ? "var(--fm-warning)" : "var(--fm-success)",
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ₹{Number(inv.balance_due || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Record payment">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => setPayDialog({ invoice: inv, amount: inv.balance_due })}
                          >
                            <PaidOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Change status">
                          <IconButton
                            size="small"
                            onClick={(e) => setStatusMenu({ anchorEl: e.currentTarget, invoice: inv })}
                          >
                            <CheckCircleOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Preview">
                          <IconButton size="small" onClick={() => setPreview(inv)}>
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Print">
                          <IconButton size="small" onClick={() => printInvoice(inv)}>
                            <PrintIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(inv)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => remove(inv.id)}>
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
            count={filtered.length}
            page={page}
            onPageChange={(e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
          </>
          ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Template</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Cycle</TableCell>
                  <TableCell>Next run</TableCell>
                  <TableCell align="right">Tax</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recurringItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState
                        icon={<AutorenewIcon />}
                        title={recurringLoading ? "Loading templates\u2026" : "No recurring templates"}
                        subtitle="Create a recurring template to bill a company on a schedule."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  recurringItems.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.name}</TableCell>
                      <TableCell>
                        {r.company_name || r.company_id}
                        {r.project_name ? (
                          <Typography variant="caption" display="block" sx={{ color: "var(--fm-text-secondary)", fontSize: "11px" }}>
                            {r.project_name}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{r.billing_cycle}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{r.next_generation || "\u2014"}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {r.tax_rate ? `${r.tax_rate}%` : "\u2014"}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        ₹{Number(r.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={r.active ? "success" : "default"} label={r.active ? "Active" : "Inactive"} />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Generate invoice now">
                          <IconButton size="small" color="primary" onClick={() => recGenerate(r)}>
                            <FileCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={r.active ? "Pause template" : "Activate template"}>
                          <IconButton size="small" onClick={() => recToggle(r)}>
                            <PowerSettingsNewIcon fontSize="small" color={r.active ? "action" : "success"} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openRecEdit(r)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => recDelete(r)}>
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
          )}
        </CardContent>
      </Card>

      {/* Change status menu */}
      <Menu
        anchorEl={statusMenu?.anchorEl}
        open={Boolean(statusMenu?.anchorEl)}
        onClose={() => setStatusMenu(null)}
      >
        {STATUS_OPTIONS.filter((o) => o.value !== (statusMenu?.invoice?.status || "")).map((o) => (
          <MenuItem key={o.value} onClick={() => handleStatusAction(o.value)}>
            {o.label}
          </MenuItem>
        ))}
        <MenuItem
          onClick={() =>
            handleRecordPayment(statusMenu.invoice, statusMenu.invoice.total)
              .then(() => { setStatusMenu(null); })
          }
        >
          Mark fully paid
        </MenuItem>
      </Menu>

      {/* Record payment dialog */}
      <Dialog open={Boolean(payDialog)} onClose={() => setPayDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Record payment — {payDialog?.invoice?.invoice_number}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Amount received (₹)"
              type="number"
              fullWidth
              value={payDialog?.amount ?? ""}
              onChange={(e) => setPayDialog({ ...payDialog, amount: e.target.value })}
              inputProps={{ min: 0, step: 0.01 }}
              autoFocus
            />
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)" }}>Invoice total</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ₹{Number(payDialog?.invoice?.total || 0).toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)" }}>Balance due</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ₹{Number(payDialog?.invoice?.balance_due || 0).toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPayDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!(Number(payDialog?.amount) > 0)}
            onClick={async () => {
              const inv = payDialog.invoice;
              await handleRecordPayment(inv, payDialog.amount);
              setPayDialog(null);
            }}
          >
            Record payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invoice preview */}
      <InvoicePreview
        invoice={preview}
        company={preview ? companies.find((c) => c.id === preview.company_id) : null}
        seller={seller}
        onClose={() => setPreview(null)}
        onPrint={() => {
          if (preview) printInvoice(preview);
        }}
      />

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={handleFormClose} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? `Edit ${editing.invoice_number}` : "New Invoice"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField
                label="Invoice number *"
                fullWidth
                {...formik.getFieldProps("invoice_number")}
                error={formik.touched.invoice_number && Boolean(formik.errors.invoice_number)}
                helperText={formik.touched.invoice_number && formik.errors.invoice_number}
              />
              <TextField
                select
                label="Company *"
                fullWidth
                {...formik.getFieldProps("company_id")}
                error={formik.touched.company_id && Boolean(formik.errors.company_id)}
                helperText={formik.touched.company_id && formik.errors.company_id}
              >
                {companies.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>
            </Box>
            <TextField
              select
              label="Project (optional)"
              fullWidth
              {...formik.getFieldProps("project_id")}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {projects
                .filter((p) => p.company_id === Number(formik.values.company_id))
                .map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
            </TextField>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField label="Issue date" type="date" fullWidth {...formik.getFieldProps("issue_date")} InputLabelProps={{ shrink: true }} />
              <TextField label="Due date" type="date" fullWidth {...formik.getFieldProps("due_date")} InputLabelProps={{ shrink: true }} />
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 650, fontSize: "14px", mb: 1 }}>Line items</Typography>
              {formik.values.items.map((item, idx) => {
                const name = (k) => `items[${idx}].${k}`;
                return (
                  <Box key={idx} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "flex-start" }}>
                    <TextField
                      label="Description"
                      size="small"
                      sx={{ flex: 1, minWidth: 0 }}
                      {...formik.getFieldProps(name("description"))}
                      error={formik.touched.items?.[idx]?.description && Boolean(formik.errors.items?.[idx]?.description)}
                      helperText=""
                    />
                    <TextField
                      label="HSN/SAC"
                      size="small"
                      sx={{ width: 100 }}
                      {...formik.getFieldProps(name("hsn_sac"))}
                    />
                    <TextField
                      label="GST %"
                      type="number"
                      size="small"
                      sx={{ width: 80 }}
                      {...formik.getFieldProps(name("tax_rate"))}
                      inputProps={{ min: 0, step: 0.1 }}
                    />
                    <TextField
                      label="Qty"
                      type="number"
                      size="small"
                      sx={{ width: 74 }}
                      {...formik.getFieldProps(name("quantity"))}
                      inputProps={{ min: 0, step: 0.5 }}
                    />
                    <TextField
                      label="Rate ₹"
                      type="number"
                      size="small"
                      sx={{ width: 100 }}
                      {...formik.getFieldProps(name("unit_price"))}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                    <Box sx={{ width: 90, pt: 1 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>
                        ₹{((Number(formik.values.items[idx]?.quantity) || 0) * (Number(formik.values.items[idx]?.unit_price) || 0)).toFixed(2)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={formik.values.items.length <= 1}
                      onClick={() => formik.setFieldValue("items", formik.values.items.filter((_, i) => i !== idx))}
                    >
                      <RemoveCircleOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  formik.setFieldValue("items", [...formik.values.items, { description: "", quantity: 1, unit_price: "", hsn_sac: "", tax_rate: "" }])
                }
              >
                Add line item
              </Button>
            </Box>

            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
              <TextField
                label="Tax rate (%)"
                type="number"
                size="small"
                sx={{ width: 150 }}
                {...formik.getFieldProps("tax_rate")}
                inputProps={{ min: 0, step: 0.1 }}
              />
              <TextField
                select
                label="Tax type"
                size="small"
                sx={{ width: 180 }}
                {...formik.getFieldProps("tax_type")}
              >
                <MenuItem value="">
                  <em>Auto</em>
                </MenuItem>
                <MenuItem value="gst">CGST + SGST</MenuItem>
                <MenuItem value="igst">IGST</MenuItem>
              </TextField>
              <Box sx={{ ml: "auto", textAlign: "right" }}>
                <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", fontSize: "13px" }}>
                  Subtotal: ₹{invoiceTotals(formik.values).subtotal.toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "15px" }}>
                  Total: ₹{invoiceTotals(formik.values).total.toFixed(2)}
                </Typography>
              </Box>
            </Box>

            {editing && (
              <TextField
                label="Amount received (₹)"
                type="number"
                fullWidth
                size="small"
                {...formik.getFieldProps("paid_amount")}
                inputProps={{ min: 0, step: 0.01 }}
              />
            )}

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

      {/* Recurring template dialog */}
      <Dialog open={recOpen} onClose={() => setRecOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{recEditing ? `Edit ${recEditing.name}` : "New Recurring Template"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField
                label="Template name *"
                fullWidth
                {...recFormik.getFieldProps("name")}
                error={recFormik.touched.name && Boolean(recFormik.errors.name)}
                helperText={recFormik.touched.name && recFormik.errors.name}
              />
              <TextField
                select
                label="Billing cycle *"
                sx={{ width: 180 }}
                {...recFormik.getFieldProps("billing_cycle")}
              >
                {BILLING_CYCLES.map((c) => (
                  <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField
                select
                label="Company *"
                fullWidth
                {...recFormik.getFieldProps("company_id")}
                error={recFormik.touched.company_id && Boolean(recFormik.errors.company_id)}
                helperText={recFormik.touched.company_id && recFormik.errors.company_id}
              >
                {companies.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Project (optional)"
                fullWidth
                {...recFormik.getFieldProps("project_id")}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {projects
                  .filter((p) => p.company_id === Number(recFormik.values.company_id))
                  .map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
              </TextField>
            </Box>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField
                label="Next generation date"
                type="date"
                fullWidth
                {...recFormik.getFieldProps("next_generation")}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Tax rate (%)"
                type="number"
                sx={{ width: 160 }}
                {...recFormik.getFieldProps("tax_rate")}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 650, fontSize: "14px", mb: 1 }}>Line items</Typography>
              {recFormik.values.items.map((item, idx) => {
                const name = (k) => `items[${idx}].${k}`;
                return (
                  <Box key={idx} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "flex-start" }}>
                    <TextField
                      label="Description"
                      size="small"
                      fullWidth
                      {...recFormik.getFieldProps(name("description"))}
                      error={recFormik.touched.items?.[idx]?.description && Boolean(recFormik.errors.items?.[idx]?.description)}
                      helperText=""
                    />
                    <TextField
                      label="Qty"
                      type="number"
                      size="small"
                      sx={{ width: 90 }}
                      {...recFormik.getFieldProps(name("quantity"))}
                      inputProps={{ min: 0, step: 0.5 }}
                    />
                    <TextField
                      label="Rate ₹"
                      type="number"
                      size="small"
                      sx={{ width: 110 }}
                      {...recFormik.getFieldProps(name("unit_price"))}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                    <Box sx={{ width: 90, pt: 1 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>
                        ₹{((Number(recFormik.values.items[idx]?.quantity) || 0) * (Number(recFormik.values.items[idx]?.unit_price) || 0)).toFixed(2)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={recFormik.values.items.length <= 1}
                      onClick={() => recFormik.setFieldValue("items", recFormik.values.items.filter((_, i) => i !== idx))}
                    >
                      <RemoveCircleOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  recFormik.setFieldValue("items", [...recFormik.values.items, { description: "", quantity: 1, unit_price: "" }])
                }
              >
                Add line item
              </Button>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <FormControlLabel
                  control={<Switch size="small" checked={Boolean(recFormik.values.auto_send)} onChange={(e) => recFormik.setFieldValue("auto_send", e.target.checked)} />}
                  label="Auto-send"
                />
                <FormControlLabel
                  control={<Switch size="small" checked={recFormik.values.active !== false} onChange={(e) => recFormik.setFieldValue("active", e.target.checked)} />}
                  label="Active"
                />
              </Box>
              <Box sx={{ ml: "auto", textAlign: "right" }}>
                <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", fontSize: "13px" }}>
                  Subtotal: ₹{recTotals.subtotal.toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "15px" }}>
                  Total: ₹{recTotals.total.toFixed(2)}
                </Typography>
              </Box>
            </Box>

            <TextField label="Notes" fullWidth multiline minRows={2} {...recFormik.getFieldProps("notes")} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRecOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={recFormik.handleSubmit} disabled={!recFormik.isValid}>
            {recEditing ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}