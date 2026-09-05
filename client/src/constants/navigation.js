import DashboardIcon from "@mui/icons-material/Dashboard";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import BusinessIcon from "@mui/icons-material/Business";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AssessmentIcon from "@mui/icons-material/Assessment";
import WorkIcon from "@mui/icons-material/Work";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", Icon: DashboardIcon, path: "/" },
  { id: "companies", label: "Companies", Icon: BusinessIcon, path: "/companies" },
  { id: "projects", label: "Projects", Icon: WorkIcon, path: "/projects" },
  { id: "invoices", label: "Invoices", Icon: RequestQuoteIcon, path: "/invoices" },
  { id: "profit", label: "Profit", Icon: TrendingUpIcon, path: "/profit" },
  { id: "transactions", label: "Transactions", Icon: ReceiptLongIcon, path: "/transactions" },
  { id: "subscriptions", label: "Subscriptions", Icon: AutorenewIcon, path: "/subscriptions" },
  { id: "time", label: "Time Tracking", Icon: AccessTimeIcon, path: "/time" },
  { id: "budget", label: "Budget Planner", Icon: AccountBalanceWalletIcon, path: "/budget" },
  { id: "reports", label: "Reports", Icon: AssessmentIcon, path: "/reports" },
  { id: "ai", label: "AI Assistant", Icon: AutoAwesomeIcon, path: "/ai" },
  { id: "reminders", label: "Reminders", Icon: NotificationsActiveIcon, path: "/reminders" },
];
