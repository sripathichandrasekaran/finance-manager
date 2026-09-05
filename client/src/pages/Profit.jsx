import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

import { fetchProfitSummary } from "../store/slices/companiesSlice.js";
import StatCard from "../components/StatCard.jsx";
import SectionCard from "../components/SectionCard.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { currentMonthISO, buildMonthOptions } from "../utils/timezone.js";

const MONTH_OPTIONS = buildMonthOptions();

export default function Profit() {
  const dispatch = useDispatch();
  const profit = useSelector((s) => s.companies.profit);
  const loading = useSelector((s) => s.companies.loading);
  const [month, setMonth] = useState(() => currentMonthISO());

  useEffect(() => {
    const [year, m] = month.split("-").map(Number);
    dispatch(fetchProfitSummary({ year, month: m }));
  }, [dispatch, month]);

  const chartData = (profit?.per_company || []).map((c) => ({
    name: c.name,
    income: c.income,
    expenses: c.expenses,
    profit: c.profit,
  }));

  const breakdown = profit?.per_company || [];
  const monthLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label || month;

  return (
    <Box>
      <PageHeader
        title="Profit"
        description="Income vs expenses per company"
        actions={
          <TextField
            select
            size="small"
            label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            sx={{ minWidth: 180, height: 44 }}
          >
            {MONTH_OPTIONS.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
        }
      />

      {/* KPI Grid */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Income" value={profit?.total_income} color="var(--fm-success)" loading={loading} icon={<TrendingUpIcon />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Expenses" value={profit?.total_expenses} color="var(--fm-danger)" loading={loading} icon={<TrendingDownIcon />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Paid Subs" value={profit?.paid_subscriptions} color="var(--fm-primary)" loading={loading} icon={<PaidOutlinedIcon />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Profit"
            value={profit?.profit}
            color={(profit?.profit ?? 0) >= 0 ? "var(--fm-success)" : "var(--fm-danger)"}
            loading={loading}
            icon={<AccountBalanceWalletIcon />}
          />
        </Grid>
      </Grid>

      {/* Invoice billing KPIs */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Invoiced" value={profit?.invoice_billed} color="var(--fm-primary)" loading={loading} icon={<ReceiptLongIcon />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Invoice Paid" value={profit?.invoice_paid} color="var(--fm-success)" loading={loading} icon={<PaidOutlinedIcon />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Invoice Pending" value={profit?.invoice_balance} color="var(--fm-warning)" loading={loading} icon={<AccountBalanceWalletIcon />} />
        </Grid>
      </Grid>

      {/* Info Banner */}
      <Card sx={{ mb: 2, border: "1px solid var(--fm-border)", borderRadius: "var(--fm-radius-md)" }}>
        <CardContent sx={{ py: 2, px: 2.25, "&:last-child": { pb: 2 } }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <InfoOutlinedIcon sx={{ fontSize: 18, color: "var(--fm-primary)", mt: 0.125 }} />
            <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", fontSize: "13px", lineHeight: 1.6 }}>
              Profit uses <strong style={{ color: "var(--fm-text-primary)" }}>paid</strong> subscriptions only for the selected month ({monthLabel}) — realized cash flow. Committed subscriptions
              (active but not yet paid in this month) show in the breakdown below. Total committed in {monthLabel}:{" "}
              <strong style={{ color: "var(--fm-primary)" }}>
                ₹{Number(profit?.committed_subscriptions || 0).toFixed(2)}/mo
              </strong>
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Analytics Grid: stacked — chart first, breakdown below */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <SectionCard title={`Income vs expenses by company (${monthLabel})`} sx={{ height: "100%" }}>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--fm-text-soft)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--fm-text-soft)" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip
                    formatter={(v) => `₹${Number(v).toFixed(2)}`}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--fm-border)",
                      backgroundColor: "var(--fm-surface)",
                      fontSize: 12,
                    }}
                    cursor={{ fill: "var(--fm-black-04)" }}
                  />
                  <Bar dataKey="income" fill="var(--fm-success)" name="Income" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="var(--fm-danger)" name="Expenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </SectionCard>
        </Grid>

        <Grid item xs={12}>
          <SectionCard title="Per-company breakdown" sx={{ height: "100%" }}>
            <TableContainer sx={{ "&::-webkit-scrollbar": { height: 8 }, "&::-webkit-scrollbar-thumb": { bgcolor: "var(--fm-scrollbar)", borderRadius: 8 } }}>
              <Table size="small" sx={{ minWidth: 560 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: "12px" }}>Company</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: "12px" }}>Income</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: "12px" }}>Expenses</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: "12px" }}>Fees Profit</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: "12px" }}>Paid Subs</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: "12px" }}>Committed</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: "12px" }}>Profit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {breakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3, color: "var(--fm-text-secondary)" }}>
                        No company-linked transactions this month
                      </TableCell>
                    </TableRow>
                  ) : (
                    breakdown.map((c) => (
                      <TableRow
                        key={c.company_id}
                        hover
                        sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                      >
                        <TableCell sx={{ fontWeight: 600, fontSize: "12px", whiteSpace: "nowrap" }}>{c.name}</TableCell>
                        <TableCell align="right" sx={{ color: "var(--fm-success)", fontSize: "12px", whiteSpace: "nowrap" }}>
                          ₹{Number(c.income || 0).toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "var(--fm-danger)", fontSize: "12px", whiteSpace: "nowrap" }}>
                          ₹{Number(c.expenses || 0).toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "var(--fm-text-primary)", fontSize: "12px", whiteSpace: "nowrap", fontWeight: 600 }}>
                          ₹{Number(c.fees_profit || 0).toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "var(--fm-primary)", fontSize: "12px", whiteSpace: "nowrap" }}>
                          ₹{Number(c.paid_subscriptions || 0).toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "var(--fm-text-secondary)", fontSize: "12px", whiteSpace: "nowrap" }}>
                          ₹{Number(c.committed_subscriptions || 0).toFixed(2)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 600,
                            color: c.profit >= 0 ? "var(--fm-success)" : "var(--fm-danger)",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ₹{Number(c.profit || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
