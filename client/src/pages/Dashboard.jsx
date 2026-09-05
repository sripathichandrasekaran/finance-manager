import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SubscriptionsIcon from "@mui/icons-material/Subscriptions";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

import { fetchStats } from "../store/slices/dashboardSlice.js";
import { fetchSubscriptions } from "../store/slices/subscriptionsSlice.js";
import { fetchTransactions } from "../store/slices/transactionsSlice.js";
import { fetchInvoices } from "../store/slices/invoicesSlice.js";
import StatCard from "../components/StatCard.jsx";
import SectionCard from "../components/SectionCard.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { currentMonthISO, buildMonthOptions } from "../utils/timezone.js";

export default function Dashboard() {
  const dispatch = useDispatch();
  const { stats, loading } = useSelector((s) => s.dashboard);
  const subscriptions = useSelector((s) => s.subscriptions.items);
  const transactions = useSelector((s) => s.transactions.items);
  const invoices = useSelector((s) => s.invoices.items);

  const [month, setMonth] = useState(() => currentMonthISO());

  const monthOptions = buildMonthOptions();

  useEffect(() => {
    const [year, m] = month.split("-").map(Number);
    dispatch(fetchStats({ year, month: m }));
    dispatch(fetchSubscriptions(false, { page_size: 300 }));
    dispatch(fetchTransactions({ page_size: 300 }));
    dispatch(fetchInvoices({ page_size: 300 }));
  }, [dispatch, month]);

  const balanceColor = stats?.month_balance >= 0 ? "var(--fm-success)" : "var(--fm-danger)";

  const categoryMap = (stats?.categories || []).reduce((m, c) => ({ ...m, [c.id]: c }), {});
  const pieData = (stats?.category_totals || [])
    .map(({ category_id, total }) => ({
      name: categoryMap[category_id]?.name || "Other",
      value: total,
      color: categoryMap[category_id]?.color || "#94A3B8",
    }))
    .filter((d) => d.value > 0);

  const upcoming = subscriptions.filter((s) => s.active).slice(0, 6);

  const invoiceTotalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + (i.balance_due || 0), 0);
  const invoiceTotalBilled = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const recent = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  return (
    <Box>
      <PageHeader
        title="Finance Overview"
        description="Track your financial performance and cash position"
        actions={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <TextField
              select
              size="small"
              label="Month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              sx={{ minWidth: 160, height: 44 }}
            >
              {monthOptions.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
            <Link to="/transactions" style={{ textDecoration: "none" }}>
              <Button variant="contained" color="primary">+ Add Transaction</Button>
            </Link>
          </Box>
        }
      />

      {/* KPI Grid */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Month Balance"
            value={stats?.month_balance}
            color={balanceColor}
            icon={<AccountBalanceWalletIcon />}
            loading={loading}
            sub={monthOptions.find((m) => m.value === month)?.label}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Month Received"
            value={stats?.month_credit}
            color="var(--fm-success)"
            icon={<TrendingUpIcon />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Month Spent"
            value={stats?.month_debit}
            color="var(--fm-danger)"
            icon={<TrendingDownIcon />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Subscriptions / Month"
            value={stats?.subscription_monthly_total}
            color="var(--fm-text-primary)"
            icon={<AutorenewIcon />}
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Invoice KPIs */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Total Invoiced"
            value={invoiceTotalBilled}
            color="var(--fm-primary)"
            icon={<ReceiptLongIcon />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Outstanding"
            value={invoiceTotalOutstanding}
            color={invoiceTotalOutstanding > 0 ? "var(--fm-warning)" : "var(--fm-success)"}
            icon={<SendOutlinedIcon />}
            loading={loading}
            sub={invoiceTotalOutstanding > 0 ? "Waiting on payment" : "All settled"}
          />
        </Grid>
      </Grid>

      {/* Analytics Grid: 2fr / 1fr */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={8}>
          <SectionCard title="Cash Flow" sx={{ height: 330 }}>
            <Box sx={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stats?.spending_series || []}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="debit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--fm-danger)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--fm-danger)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="credit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--fm-success)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--fm-success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--fm-text-soft)" }}
                    tickFormatter={(d) => d.slice(5)}
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
                    formatter={(v) => `₹${v.toFixed ? v.toFixed(2) : v}`}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--fm-border)",
                      backgroundColor: "var(--fm-surface)",
                      fontSize: 12,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="credit"
                    stroke="var(--fm-success)"
                    fill="url(#credit)"
                    strokeWidth={2}
                    name="Income"
                  />
                  <Area
                    type="monotone"
                    dataKey="debit"
                    stroke="var(--fm-danger)"
                    fill="url(#debit)"
                    strokeWidth={2}
                    name="Expenses"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <SectionCard title="Spending Breakdown" sx={{ height: 330 }}>
            {pieData.length === 0 ? (
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
                  <AccountBalanceWalletIcon sx={{ fontSize: 22 }} />
                </Box>
                <Typography
                  variant="body2"
                  sx={{ color: "var(--fm-text-primary)", fontWeight: 600, fontSize: "13px" }}
                >
                  No spending yet
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "var(--fm-text-secondary)", maxWidth: 200, lineHeight: 1.5 }}
                >
                  Your spending categories will appear here once transactions are recorded.
                </Typography>
              </Box>
            ) : (
              <Box>
                <Box sx={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => `₹${Number(v).toFixed(2)}`}
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid var(--fm-border)",
                          backgroundColor: "var(--fm-surface)",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
                <Box sx={{ mt: 0.5 }}>
                  {pieData.slice(0, 4).map((d) => (
                    <Box
                      key={d.name}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        py: 0.5,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: d.color,
                          }}
                        />
                        <Typography variant="body2" sx={{ color: "var(--fm-text-soft)", fontSize: "12px" }}>
                          {d.name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "12px" }}>
                        ₹{Number(d.value).toFixed(2)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      {/* Lower Grid: 1.3fr / 1fr */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <SectionCard
            title="Recent Transactions"
            action={<IconLink to="/transactions">View all</IconLink>}
          >
            {recent.length === 0 ? (
              <Box
                sx={{
                  py: 4,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "var(--fm-bg-soft)",
                    color: "var(--fm-text-faint)",
                  }}
                >
                  <ReceiptLongIcon sx={{ fontSize: 20 }} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "13px" }}>
                  No transactions yet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Add your first transaction to see it here.
                </Typography>
              </Box>
            ) : (
              <Box>
                {recent.map((t, i) => (
                  <Box
                    key={t.id}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      py: 1.25,
                      borderBottom: i < recent.length - 1 ? "1px solid var(--fm-black-04)" : "none",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontSize: "13px",
                        }}
                      >
                        {t.description || t.category || "Transaction"}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: "11px" }}
                      >
                        {t.date} {t.category ? `• ${t.category}` : ""}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: t.type === "credit" ? "var(--fm-success)" : "var(--fm-danger)",
                        whiteSpace: "nowrap",
                        fontSize: "13px",
                      }}
                    >
                      {t.type === "credit" ? "+" : "\u2212"}₹{Number(t.amount).toFixed(2)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={5}>
          <SectionCard
            title="Upcoming Subscriptions"
            action={<IconLink to="/subscriptions">View all</IconLink>}
          >
            {upcoming.length === 0 ? (
              <Box
                sx={{
                  py: 4,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "var(--fm-bg-soft)",
                    color: "var(--fm-text-faint)",
                  }}
                >
                  <SubscriptionsIcon sx={{ fontSize: 20 }} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "13px" }}>
                  No upcoming subscriptions
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  You have no upcoming subscriptions.
                </Typography>
              </Box>
            ) : (
              <Box>
                {upcoming.map((s, i) => (
                  <Box
                    key={s.id}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      py: 1.25,
                      borderBottom: i < upcoming.length - 1 ? "1px solid var(--fm-black-04)" : "none",
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "13px" }}>
                        {s.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: "11px" }}
                      >
                        {s.billing_cycle} • next: {s.next_billing}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, color: "var(--fm-danger)", fontSize: "13px" }}
                    >
                      ₹{Number(s.amount).toFixed(2)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}

function IconLink({ to, children }) {
  return (
    <Link
      to={to}
      style={{
        color: "var(--fm-primary)",
        textDecoration: "none",
        fontWeight: 600,
        fontSize: "13px",
      }}
    >
      {children}
    </Link>
  );
}
