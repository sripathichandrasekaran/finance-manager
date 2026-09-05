import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  total: 0,
  loading: false,
  error: null,
};

export const fetchTransactions = createAsyncThunk(
  "transactions/fetch",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data, headers } = await axios.get("/transactions", { params });
      return { data, total: Number(headers["x-total-count"] || data.length) };
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to load transactions");
    }
  }
);

export const createTransaction = createAsyncThunk(
  "transactions/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post("/transactions", payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to create transaction");
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  "transactions/delete",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`/transactions/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to delete transaction");
    }
  }
);

const transactionsSliceInstance = createSlice({
  name: "transactions",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchTransactions.fulfilled, (state, action) => { state.items = action.payload.data; state.total = action.payload.total; state.loading = false; })
      .addCase(fetchTransactions.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createTransaction.rejected, (state, action) => { state.error = action.payload; })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.items = state.items.filter((t) => t.id !== action.payload);
      });
  },
});

export const { clearError } = transactionsSliceInstance.actions;
export default transactionsSliceInstance.reducer;
