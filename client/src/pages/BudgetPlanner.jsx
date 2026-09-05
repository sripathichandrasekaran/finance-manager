import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Typography,
  Tooltip,
  TablePagination,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import {
  fetchBudgets,
  createBudget,
  deleteBudget,
  clearError,
} from '../store/slices/budgetsSlice';
import { fetchStats } from '../store/slices/dashboardSlice';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return months;
}

const BudgetPlanner = () => {
  const dispatch = useDispatch();
  const { items: budgets = [], total, loading, error } = useSelector((state) => state.budgets);
  const { stats } = useSelector((state) => state.dashboard);

  const categoryMap = useMemo(() => {
    if (!stats) return {};
    const map = {};
    if (Array.isArray(stats.categories)) {
      stats.categories.forEach((c) => {
        if (c.id && c.name) {
          map[c.name] = c.id;
        } else if (typeof c === 'string') {
          map[c] = null;
        }
      });
    }
    return map;
  }, [stats]);

  const categoryNames = useMemo(() => Object.keys(categoryMap), [categoryMap]);

  const last12 = useMemo(() => getLast12Months(), []);
  const current = last12[0];

  const [selectedMonth, setSelectedMonth] = useState(current.month);
  const [selectedYear, setSelectedYear] = useState(current.year);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const formik = useFormik({
    initialValues: { category: '', amount: '', month: current.month, year: current.year },
    validationSchema: Yup.object({
      category: Yup.string().required('Category is required'),
      amount: Yup.number()
        .typeError('Enter a valid amount')
        .positive('Amount must be greater than 0')
        .required('Amount is required'),
    }),
    onSubmit: async (values) => {
      const catId = categoryMap[values.category];
      if (catId === undefined) return;

      setSubmitting(true);
      const result = await dispatch(
        createBudget({
          category_id: catId,
          amount: Number(values.amount),
          month: Number(values.month),
          year: Number(values.year),
        })
      );
      setSubmitting(false);

      if (!result.error) {
        setDialogOpen(false);
        formik.resetForm();
        dispatch(fetchBudgets({ year: selectedYear, month: selectedMonth, page_size: 300 }));
      }
    },
  });

  useEffect(() => {
    dispatch(fetchBudgets({ year: selectedYear, month: selectedMonth, page_size: 300 }));
  }, [dispatch, selectedYear, selectedMonth]);

  useEffect(() => {
    dispatch(fetchStats());
  }, [dispatch]);

  useEffect(() => {
    formik.setFieldValue('month', selectedMonth);
    formik.setFieldValue('year', selectedYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  const totalBudgeted = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent || 0), 0);
  const totalRemaining = totalBudgeted - totalSpent;

  const handleDelete = (id) => {
    dispatch(deleteBudget(id)).then(() => {
      dispatch(fetchBudgets({ year: selectedYear, month: selectedMonth, page_size: 300 }));
    });
  };

  const handleClose = () => {
    setDialogOpen(false);
    formik.resetForm();
    formik.setErrors({});
    dispatch(clearError());
  };

  const years = useMemo(() => {
    const y = current.year;
    return [y + 1, y, y - 1, y - 2];
  }, [current.year]);

  return (
    <Box>
      <PageHeader
        title="Budget Planner"
        description="Plan and track your monthly spending limits"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Add Budget
          </Button>
        }
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          select
          label="Month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          size="small"
          sx={{ minWidth: 140 }}
        >
          {last12.map((m) => (
            <MenuItem key={`${m.year}-${m.month}`} value={m.month}>
              {monthNames[m.month - 1]} {m.year}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Year"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          size="small"
          sx={{ minWidth: 100 }}
        >
          {years.map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Total Budgeted" value={totalBudgeted} icon={<AccountBalanceWalletIcon />} color="var(--fm-primary)" loading={loading} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Total Spent" value={totalSpent} icon={<AccountBalanceWalletIcon />} color="var(--fm-warning, #f59e0b)" loading={loading} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Remaining" value={totalRemaining} icon={<AccountBalanceWalletIcon />} color={totalRemaining >= 0 ? 'var(--fm-success, #22c55e)' : 'var(--fm-error, #ef4444)'} loading={loading} />
        </Grid>
      </Grid>

      {loading && budgets.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <Typography sx={{ color: 'var(--fm-text-secondary)' }}>Loading budgets...</Typography>
        </Box>
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={<AccountBalanceWalletIcon />}
          title="No budgets set"
          subtitle="Create budgets to track your spending limits."
        />
      ) : (
        <Grid container spacing={3}>
          {budgets
            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
            .map((b) => {
            const spent = Number(b.spent || 0);
            const amount = Number(b.amount);
            const pct = amount > 0 ? Math.min((spent / amount) * 100, 100) : 0;
            const over = spent > amount;
            const remaining = amount - spent;

            return (
              <Grid item xs={12} sm={6} md={4} key={b.id}>
                <Card
                  sx={{
                    backgroundColor: 'var(--fm-bg-card)',
                    border: '1px solid var(--fm-border)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'var(--fm-primary)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1.5,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--fm-text-primary)',
                        }}
                      >
                        {b.category_name || `Category #${b.category_id}`}
                      </Typography>
                      <Tooltip title="Delete budget">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(b.id)}
                          sx={{
                            color: 'var(--fm-text-secondary)',
                            '&:hover': { color: 'var(--fm-error, #ef4444)' },
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <Typography
                      sx={{ fontSize: '12px', color: 'var(--fm-text-secondary)', mb: 1.5 }}
                    >
                      Spent: ₹{spent.toLocaleString()} / ₹{amount.toLocaleString()}
                    </Typography>

                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'var(--fm-bg-secondary)',
                        mb: 1.5,
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          backgroundColor: over ? 'var(--fm-error, #ef4444)' : 'var(--fm-success, #22c55e)',
                        },
                      }}
                    />

                    <Typography
                      sx={{
                        fontSize: '12px',
                        color: over ? 'var(--fm-error, #ef4444)' : 'var(--fm-success, #22c55e)',
                        fontWeight: 500,
                      }}
                    >
                      {over ? 'Over by ' : 'Remaining: '}₹{Math.abs(remaining).toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(e, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      />

      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ color: 'var(--fm-text-primary)' }}>Add Budget</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error" onClose={() => dispatch(clearError())}>{error}</Alert>}

            {categoryNames.length === 0 ? (
              <Alert severity="info">
                No categories available. Add a transaction first to create categories.
              </Alert>
            ) : (
              <TextField
                select
                label="Category"
                {...formik.getFieldProps('category')}
                fullWidth
                size="small"
                error={formik.touched.category && Boolean(formik.errors.category)}
                helperText={formik.touched.category && formik.errors.category}
              >
                {categoryNames.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              label="Amount"
              type="number"
              {...formik.getFieldProps('amount')}
              fullWidth
              size="small"
              inputProps={{ min: 0 }}
              error={formik.touched.amount && Boolean(formik.errors.amount)}
              helperText={formik.touched.amount && formik.errors.amount}
            />

            <TextField
              select
              label="Month"
              {...formik.getFieldProps('month')}
              fullWidth
              size="small"
            >
              {monthNames.map((name, i) => (
                <MenuItem key={i + 1} value={i + 1}>
                  {name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Year"
              {...formik.getFieldProps('year')}
              fullWidth
              size="small"
            >
              {years.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={handleClose} sx={{ color: 'var(--fm-text-secondary)' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={formik.handleSubmit}
            disabled={submitting || categoryNames.length === 0 || !formik.isValid}
          >
            {submitting ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BudgetPlanner;
