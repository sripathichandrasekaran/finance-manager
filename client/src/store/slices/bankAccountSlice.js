import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  total: 0,
  loading: false,
  error: null,
};

export const fetchBankAccounts = createAsyncThunk(
  "bankAccounts/fetch",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data, headers } = await axios.get("/bank-accounts", { params });
      return { data, total: Number(headers["x-total-count"] || data.length) };
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to load bank accounts");
    }
  }
);

export const createBankAccount = createAsyncThunk(
  "bankAccounts/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post("/bank-accounts", payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to create bank account");
    }
  }
);

export const updateBankAccount = createAsyncThunk(
  "bankAccounts/update",
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`/bank-accounts/${id}`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to update bank account");
    }
  }
);

export const deleteBankAccount = createAsyncThunk(
  "bankAccounts/delete",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`/bank-accounts/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to delete bank account");
    }
  }
);

const slice = createSlice({
  name: "bankAccounts",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBankAccounts.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchBankAccounts.fulfilled, (state, action) => { state.items = action.payload.data; state.total = action.payload.total; state.loading = false; })
      .addCase(fetchBankAccounts.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createBankAccount.fulfilled, (state, action) => { state.items.unshift(action.payload); })
      .addCase(createBankAccount.rejected, (state, action) => { state.error = action.payload; })
      .addCase(updateBankAccount.fulfilled, (state, action) => {
        const idx = state.items.findIndex((a) => a.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(updateBankAccount.rejected, (state, action) => { state.error = action.payload; })
      .addCase(deleteBankAccount.fulfilled, (state, action) => {
        state.items = state.items.filter((a) => a.id !== action.payload);
      })
      .addCase(deleteBankAccount.rejected, (state, action) => { state.error = action.payload; });
  },
});

export const { clearError } = slice.actions;
export default slice.reducer;