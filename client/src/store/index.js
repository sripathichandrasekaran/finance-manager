import { configureStore } from "@reduxjs/toolkit";
import { bindApiStore } from "../services/api.js";
import transactionsReducer from "./slices/transactionsSlice.js";
import subscriptionsReducer from "./slices/subscriptionsSlice.js";
import remindersReducer from "./slices/remindersSlice.js";
import dashboardReducer from "./slices/dashboardSlice.js";
import companiesReducer from "./slices/companiesSlice.js";
import timeEntriesReducer from "./slices/timeEntriesSlice.js";
import budgetsReducer from "./slices/budgetsSlice.js";
import notificationsReducer from "./slices/notificationsSlice.js";
import projectsReducer from "./slices/projectsSlice.js";
import authReducer from "./slices/authSlice.js";
import invoicesReducer from "./slices/invoicesSlice.js";

export const store = configureStore({
  reducer: {
    transactions: transactionsReducer,
    subscriptions: subscriptionsReducer,
    reminders: remindersReducer,
    dashboard: dashboardReducer,
    companies: companiesReducer,
    timeEntries: timeEntriesReducer,
    budgets: budgetsReducer,
    notifications: notificationsReducer,
    projects: projectsReducer,
    auth: authReducer,
    invoices: invoicesReducer,
  },
});

bindApiStore(store);
