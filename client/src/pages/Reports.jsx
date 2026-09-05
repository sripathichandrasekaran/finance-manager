import React, { useEffect, useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import PageHeader from "../components/PageHeader.jsx";
import SectionCard from "../components/SectionCard.jsx";
import api from "../services/api.js";
import { currentMonthISO, buildMonthOptions } from "../utils/timezone.js";

const MONTH_OPTIONS = buildMonthOptions();

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function Reports() {
  const [month, setMonth] = useState(() => currentMonthISO());
  const [pnl, setPnl] = useState(null);
  const [annual, setAnnual] = useState(null);
  const [cashflow, setCashflow] = useState(null);
  const [tax, setTax] = useState(null);
  const [taxRate, setTaxRate] = useState(5);
  const [loadingPnl, setLoadingPnl] = useState(false);
  const [loadingAnnual, setLoadingAnnual] = useState(false);

  const currentYear = useMemo(() => Number(month.split("-")[0]), [month]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPnl(true);
    api
      .get("/reports/pnl", { params: { year: Number(month.split("-")[0]), month: Number(month.split("-")[1]) } })
      .then((res) => {
        if (!cancelled) setPnl(res.data);
      })
      .catch(() => {
        if (!cancelled) setPnl(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPnl(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    setLoadingAnnual(true);
    api
      .get("/reports/annual", { params: { year: currentYear } })
      .then((res) => {
        if (!cancelled) setAnnual(res.data);
      })
      .catch(() => {
        if (!cancelled) setAnnual(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingAnnual(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/reports/cashflow")
      .then((res) => {
        if (!cancelled) setCashflow(res.data);
      })
      .catch(() => {
        if (!cancelled) setCashflow(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/reports/tax-estimate", {
        params: { year: Number(month.split("-")[0]), month: Number(month.split("-")[1]), income_tax_rate: Number(taxRate) },
      })
      .then((res) => {
        if (!cancelled) setTax(res.data);
      })
      .catch(() => {
        if (!cancelled) setTax(null);
      });
    return () => {
      cancelled = true;
    };
  }, [month, taxRate]);

  const income = pnl?.income ?? 0;
  const expenses = pnl?.total_expenses ?? 0;
  const paidSubscriptions = pnl?.paid_subscriptions ?? 0;
  const netProfit = pnl?.net_profit ?? income - expenses;
  const breakdown = pnl?.expenses ?? [];

  const annualData = useMemo(() => {
    if (!annual?.months || !Array.isArray(annual.months)) return [];
    return annual.months.map((m) => ({
      name: MONTH_SHORT[(m.month || 1) - 1] || `M${m.month}`,
      income: Number(m.income) || 0,
      expenses: Number(m.expenses) || 0,
    }));
  }, [annual]);

  const hasAnnualData = annualData.length > 0 && annualData.some((d) => d.income > 0 || d.expenses > 0);

  return (
    <Box>
      <PageHeader
        title="Reports"
        description="Profit & loss summaries and annual trends"
        actions={
          <TextField
            select
            size="small"
            label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            {MONTH_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        }
      />

      {/* P&L Summary Cards */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: 100 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography
                sx={{
                  color: "var(--fm-text-secondary)",
                  fontWeight: 600,
                  fontSize: "12px",
                  lineHeight: 1.2,
                }}
              >
                Income
              </Typography>
              <Typography
                sx={{
                  color: "var(--fm-success)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  fontSize: "25px",
                  lineHeight: 1,
                  mt: 1.5,
                }}
              >
                {loadingPnl ? (
                  <Skeleton width={110} />
                ) : (
                  `₹${Number(income).toFixed(2)}`
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: 100 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography
                sx={{
                  color: "var(--fm-text-secondary)",
                  fontWeight: 600,
                  fontSize: "12px",
                  lineHeight: 1.2,
                }}
              >
                Expenses
              </Typography>
              <Typography
                sx={{
                  color: "var(--fm-danger)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  fontSize: "25px",
                  lineHeight: 1,
                  mt: 1.5,
                }}
              >
                {loadingPnl ? (
                  <Skeleton width={110} />
                ) : (
                  `₹${Number(expenses).toFixed(2)}`
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: 100 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography
                sx={{
                  color: "var(--fm-text-secondary)",
                  fontWeight: 600,
                  fontSize: "12px",
                  lineHeight: 1.2,
                }}
              >
                Paid Subscriptions
              </Typography>
              <Typography
                sx={{
                  color: "var(--fm-warning-bright)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  fontSize: "25px",
                  lineHeight: 1,
                  mt: 1.5,
                }}
              >
                {loadingPnl ? (
                  <Skeleton width={110} />
                ) : (
                  `₹${Number(paidSubscriptions).toFixed(2)}`
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: 100 }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography
                sx={{
                  color: "var(--fm-text-secondary)",
                  fontWeight: 600,
                  fontSize: "12px",
                  lineHeight: 1.2,
                }}
              >
                Net Profit
              </Typography>
              <Typography
                sx={{
                  color:
                    netProfit >= 0
                      ? "var(--fm-success)"
                      : "var(--fm-danger)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  fontSize: "25px",
                  lineHeight: 1,
                  mt: 1.5,
                }}
              >
                {loadingPnl ? (
                  <Skeleton width={110} />
                ) : (
                  `${netProfit >= 0 ? "+" : "\u2212"}₹${Math.abs(Number(netProfit)).toFixed(2)}`
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Expenses Breakdown & Annual Chart */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <SectionCard title="Expenses Breakdown" sx={{ minHeight: 330 }}>
            {loadingPnl ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rounded" height={36} />
                ))}
              </Box>
            ) : breakdown.length === 0 ? (
              <Box
                sx={{
                  height: 250,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1.5,
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "var(--fm-bg-soft)",
                    color: "var(--fm-text-faint)",
                  }}
                >
                  <Typography sx={{ fontSize: 22 }}>&#x1F4C9;</Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{ color: "var(--fm-text-primary)", fontWeight: 600, fontSize: "13px" }}
                >
                  No expenses for this month
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "var(--fm-text-secondary)", maxWidth: 200, lineHeight: 1.5 }}
                >
                  Expense breakdown will appear here once transactions are recorded.
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, fontSize: "12px" }}>Category</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "12px" }}>
                        Amount
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "12px" }}>
                        % of Total
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {breakdown.map((row) => {
                      const pct = expenses > 0 ? ((Number(row.amount) / expenses) * 100).toFixed(1) : "0.0";
                      return (
                        <TableRow key={row.category || "other"} hover>
                          <TableCell>
                            <Chip
                              label={row.category || "Other"}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "11px" }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, fontSize: "13px" }}>
                            ₹{Number(row.amount).toFixed(2)}
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{ fontSize: "12px", color: "var(--fm-text-secondary)" }}
                            >
                              {pct}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={7}>
          <SectionCard
            title={`Annual Summary \u2014 ${currentYear}`}
            sx={{ minHeight: 330 }}
          >
            {loadingAnnual ? (
              <Box sx={{ height: 250, display: "grid", placeItems: "center" }}>
                <Skeleton variant="rounded" width="100%" height={250} />
              </Box>
            ) : !hasAnnualData ? (
              <Box
                sx={{
                  height: 250,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1.5,
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "var(--fm-bg-soft)",
                    color: "var(--fm-text-faint)",
                  }}
                >
                  <Typography sx={{ fontSize: 22 }}>&#x1F4CA;</Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{ color: "var(--fm-text-primary)", fontWeight: 600, fontSize: "13px" }}
                >
                  No data for {currentYear}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "var(--fm-text-secondary)", maxWidth: 200, lineHeight: 1.5 }}
                >
                  Annual income and expenses will appear once transactions are recorded.
                </Typography>
              </Box>
            ) : (
              <Box>
                <Box sx={{ display: "flex", gap: 2, mb: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: "var(--fm-success)" }} />
                    <Typography variant="caption" sx={{ color: "var(--fm-text-secondary)", fontSize: "11px" }}>
                      Income
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: "var(--fm-danger)" }} />
                    <Typography variant="caption" sx={{ color: "var(--fm-text-secondary)", fontSize: "11px" }}>
                      Expenses
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={annualData}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
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
                        width={48}
                      />
                      <Tooltip
                        formatter={(v, name) => [`₹${Number(v).toFixed(2)}`, name === "income" ? "Income" : "Expenses"]}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid var(--fm-border)",
                          backgroundColor: "var(--fm-surface)",
                          fontSize: 12,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        }}
                        cursor={{ fill: "var(--fm-black-04)" }}
                      />
                      <Bar
                        dataKey="income"
                        fill="var(--fm-success)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                        name="Income"
                      />
                      <Bar
                        dataKey="expenses"
                        fill="var(--fm-danger)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                        name="Expenses"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      {/* Cash Flow Projection */}
      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12} md={7}>
          <SectionCard title="Cash Flow Projection" sx={{ minHeight: 240 }}>
            {!cashflow ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={40} />)}
              </Box>
            ) : (
              <Box>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    py: 1,
                    borderRadius: 2,
                    bgcolor: "var(--fm-bg-soft)",
                    px: 1.5,
                  }}
                >
                  <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", fontSize: "13px" }}>
                    Current cash
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    ₹{Number(cashflow?.current_cash).toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 1.5 }}>
                  {(cashflow?.buckets || []).map((b) => {
                    const color = b.projected_balance >= 0 ? "var(--fm-success)" : "var(--fm-danger)";
                    return (
                      <Card key={b.days} sx={{ width: "100%", minWidth: "180px", flexBasis: "30%" }}>
                        <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                          <Typography variant="caption" sx={{ color: "var(--fm-text-secondary)", fontSize: "11px" }}>
                            {b.days}-day view
                          </Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: "18px", color, mt: 0.5 }}>
                            ₹{Number(b.projected_balance).toFixed(2)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "var(--fm-text-secondary)", fontSize: "11px", display: "block" }}>
                            In +₹{Number(b.incoming).toFixed(2)} / Out −₹{Number(b.outgoing).toFixed(2)}
                          </Typography>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Box>
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={5}>
          <SectionCard
            title="Tax / GST Estimate"
            action={
              <TextField
                size="small"
                type="number"
                label="Tax rate %"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                inputProps={{ min: 0, step: 0.5 }}
                sx={{ width: 120, "& .MuiFormControlLabel-root": { fontSize: "12px" } }}
              />
            }
            sx={{ minHeight: 240 }}
          >
            {!tax ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={36} />)}
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", fontSize: "13px" }}>GST collectible</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{Number(tax?.gst_collectible).toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", fontSize: "13px" }}>Receipts (income)</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{Number(tax?.receipts).toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", fontSize: "13px" }}>Deductible expenses</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{Number(tax?.deductible_expenses).toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--fm-border)", pb: 0.75 }}>
                  <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", fontSize: "13px" }}>Taxable income</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{Number(tax?.taxable_income).toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", fontSize: "13px" }}>
                    Estimated income tax ({Number(tax?.income_tax_rate || 0).toFixed(0)}%)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--fm-warning-bright)" }}>
                    ₹{Number(tax?.estimated_income_tax).toFixed(2)}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: "var(--fm-text-secondary)", lineHeight: 1.5, fontSize: "11px" }}>
                  Estimates only — set your effective income-tax rate (%) above, then consult a CA. GST here is the tax already applied on invoices for {month}.
                </Typography>
              </Box>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
