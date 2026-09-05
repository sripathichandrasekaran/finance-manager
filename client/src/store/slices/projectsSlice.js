import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  total: 0,
  unassigned: [],
  companyReport: null,
  loading: false,
  error: null,
};

export const fetchProjects = createAsyncThunk(
  "projects/fetch",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data, headers } = await axios.get("/projects", { params });
      return { data, total: Number(headers["x-total-count"] || data.length) };
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to load projects");
    }
  }
);

export const createProject = createAsyncThunk(
  "projects/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post("/projects", payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to create project");
    }
  }
);

export const updateProject = createAsyncThunk(
  "projects/update",
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`/projects/${id}`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to update project");
    }
  }
);

export const deleteProject = createAsyncThunk(
  "projects/delete",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`/projects/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to delete project");
    }
  }
);

export const fetchCompanyProjectReport = createAsyncThunk(
  "projects/companyReport",
  async (companyId, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`/projects/report/company/${companyId}/analytics`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to load company project report");
    }
  }
);

export const fetchUnassignedTransactions = createAsyncThunk(
  "projects/unassigned",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await axios.get("/projects/unassigned/transactions", { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to load unassigned transactions");
    }
  }
);

export const linkTransactionToProject = createAsyncThunk(
  "projects/link",
  async ({ projectId, txId }, { rejectWithValue }) => {
    try {
      await axios.post(`/projects/${projectId}/transactions/${txId}`);
      return { projectId, txId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to link transaction");
    }
  }
);

const slice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    clearError(s) { s.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(fetchProjects.pending, (s) => { s.loading = true; })
      .addCase(fetchProjects.fulfilled, (s, a) => { s.items = a.payload.data; s.total = a.payload.total; s.loading = false; })
      .addCase(fetchProjects.rejected, (s, a) => { s.error = a.payload; s.loading = false; })
      .addCase(createProject.fulfilled, (s, a) => { s.items.push(a.payload); })
      .addCase(createProject.rejected, (s, a) => { s.error = a.payload; })
      .addCase(updateProject.fulfilled, (s, a) => {
        s.items = s.items.map((p) => (p.id === a.payload.id ? a.payload : p));
        if (s.companyReport?.projects) {
          s.companyReport.projects = s.companyReport.projects.map((p) =>
            p.id === a.payload.id ? { ...p, ...a.payload, analytics: a.payload.analytics } : p
          );
          s.companyReport = _recompute(s.companyReport);
        }
      })
      .addCase(updateProject.rejected, (s, a) => { s.error = a.payload; })
      .addCase(deleteProject.fulfilled, (s, a) => { s.items = s.items.filter((p) => p.id !== a.payload); })
      .addCase(deleteProject.rejected, (s, a) => { s.error = a.payload; })
      .addCase(fetchCompanyProjectReport.pending, (s) => { s.loading = true; })
      .addCase(fetchCompanyProjectReport.fulfilled, (s, a) => {
        s.companyReport = a.payload;
        s.loading = false;
      })
      .addCase(fetchCompanyProjectReport.rejected, (s, a) => { s.error = a.payload; s.loading = false; })
      .addCase(fetchUnassignedTransactions.fulfilled, (s, a) => { s.unassigned = a.payload; })
      .addCase(fetchUnassignedTransactions.rejected, (s, a) => { s.error = a.payload; })
      .addCase(linkTransactionToProject.fulfilled, (s, a) => {
        s.unassigned = s.unassigned.filter((t) => t.id !== a.payload.txId);
      })
      .addCase(linkTransactionToProject.rejected, (s, a) => { s.error = a.payload; });
  },
});

function _recompute(report) {
  report.income = report.projects.reduce((sum, p) => sum + (p.analytics?.income || 0), 0);
  report.expenses = report.projects.reduce((sum, p) => sum + (p.analytics?.expenses || 0), 0);
  report.profit = report.income - report.expenses;
  return report;
}

export const { clearError } = slice.actions;
export default slice.reducer;
