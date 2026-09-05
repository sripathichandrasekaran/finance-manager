import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  total: 0,
  profit: null,
  loading: false,
  error: null,
};

export const fetchCompanies = createAsyncThunk("companies/fetch", async (params = {}) => {
  const { data, headers } = await axios.get("/companies", { params });
  return { data, total: Number(headers["x-total-count"] || data.length) };
});

export const createCompany = createAsyncThunk(
  "companies/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post("/companies", payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to create company");
    }
  }
);

export const updateCompany = createAsyncThunk(
  "companies/update",
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`/companies/${id}`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to update company");
    }
  }
);

export const deleteCompany = createAsyncThunk("companies/delete", async (id) => {
  await axios.delete(`/companies/${id}`);
  return id;
});

export const fetchProfitSummary = createAsyncThunk("companies/profit", async ({ year, month } = {}) => {
  const { data } = await axios.get("/companies/summary/profit", { params: { year, month } });
  return data;
});

const companiesSlice = createSlice({
  name: "companies",
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanies.pending, (state) => { state.loading = true; })
      .addCase(fetchCompanies.fulfilled, (state, action) => { state.items = action.payload.data; state.total = action.payload.total; state.loading = false; })
      .addCase(fetchCompanies.rejected, (state, action) => { state.error = action.payload; state.loading = false; })
      .addCase(fetchProfitSummary.pending, (state) => { state.loading = true; })
      .addCase(fetchProfitSummary.fulfilled, (state, action) => { state.profit = action.payload; state.loading = false; })
      .addCase(fetchProfitSummary.rejected, (state, action) => { state.error = action.payload; state.loading = false; })
      .addCase(createCompany.fulfilled, (state, action) => { state.items.push(action.payload); })
      .addCase(createCompany.rejected, (state, action) => { state.error = action.payload; })
      .addCase(updateCompany.fulfilled, (state, action) => {
        state.items = state.items.map((c) => (c.id === action.payload.id ? action.payload : c));
      })
      .addCase(deleteCompany.fulfilled, (state, action) => {
        state.items = state.items.filter((c) => c.id !== action.payload);
      });
  },
});

export const { clearError } = companiesSlice.actions;
export default companiesSlice.reducer;
