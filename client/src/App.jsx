import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AuthGate from "./components/AuthGate.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Transactions from "./pages/Transactions.jsx";
import Subscriptions from "./pages/Subscriptions.jsx";
import AIAssistant from "./pages/AIAssistant.jsx";
import Reminders from "./pages/Reminders.jsx";
import Companies from "./pages/Companies.jsx";
import Projects from "./pages/Projects.jsx";
import Invoices from "./pages/Invoices.jsx";
import Profit from "./pages/Profit.jsx";
import TimeTracking from "./pages/TimeTracking.jsx";
import BudgetPlanner from "./pages/BudgetPlanner.jsx";
import Reports from "./pages/Reports.jsx";
import AccountSettings from "./pages/AccountSettings.jsx";

export default function App() {
  return (
    <AuthGate>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/profit" element={<Profit />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/time" element={<TimeTracking />} />
          <Route path="/budget" element={<BudgetPlanner />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/ai" element={<AIAssistant />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/settings" element={<AccountSettings />} />
        </Routes>
      </Layout>
    </AuthGate>
  );
}
