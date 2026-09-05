import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = { items: [], total: 0, loading: false, error: null };

export const fetchBudgets = createAsyncThunk("budgets/fetch", async ({ year, month, page = 1, page_size = 100 }) => {
  const { data, headers } = await axios.get("/budgets", { params: { year, month, page, page_size } });
  return { data, total: Number(headers["x-total-count"] || data.length) };
});

export const createBudget = createAsyncThunk("budgets/create", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await axios.post("/budgets", payload);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || "Failed to create budget");
  }
});

export const updateBudget = createAsyncThunk("budgets/update", async ({ id, ...payload }, { rejectWithValue }) => {
  try {
    const { data } = await axios.patch(`/budgets/${id}`, payload);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || "Failed to update budget");
  }
});

export const deleteBudget = createAsyncThunk("budgets/delete", async (id) => {
  await axios.delete(`/budgets/${id}`);
  return { id };
});

const slice = createSlice({
  name: "budgets",
  initialState,
  reducers: { clearError(s) { s.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchBudgets.pending, (s) => { s.loading = true; })
      .addCase(fetchBudgets.fulfilled, (s, a) => { s.items = a.payload.data; s.total = a.payload.total; s.loading = false; })
      .addCase(fetchBudgets.rejected, (s, a) => { s.error = a.payload; s.loading = false; })
      .addCase(createBudget.fulfilled, (s, a) => { s.items.push(a.payload); })
      .addCase(updateBudget.fulfilled, (s, a) => {
        s.items = s.items.map((b) => (b.id === a.payload.id ? a.payload : b));
      })
      .addCase(deleteBudget.fulfilled, (s, a) => {
        s.items = s.items.filter((b) => b.id !== a.payload.id);
      });
  },
});

export const { clearError } = slice.actions;
export default slice.reducer;
