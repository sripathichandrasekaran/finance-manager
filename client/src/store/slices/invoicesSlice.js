import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  total: 0,
  recurringItems: [],
  loading: false,
  recurringLoading: false,
  error: null,
};

export const fetchInvoices = createAsyncThunk(
  "invoices/fetch",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data, headers } = await axios.get("/invoices", { params });
      return { data, total: Number(headers["x-total-count"] || data.length) };
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to load invoices");
    }
  }
);

export const createInvoice = createAsyncThunk(
  "invoices/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post("/invoices", payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to create invoice");
    }
  }
);

export const updateInvoice = createAsyncThunk(
  "invoices/update",
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`/invoices/${id}`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to update invoice");
    }
  }
);

export const updateInvoiceStatus = createAsyncThunk(
  "invoices/status",
  async ({ id, status, paid_amount }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`/invoices/${id}/status`, {
        status,
        ...(paid_amount !== undefined ? { paid_amount } : {}),
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to update invoice status");
    }
  }
);

export const recordPayment = createAsyncThunk(
  "invoices/recordPayment",
  async ({ invoiceId, amount, payment_date, payment_method, reference, notes }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`/invoices/${invoiceId}/payments`, {
        amount,
        payment_date,
        payment_method,
        reference,
        notes,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to record payment");
    }
  }
);

export const deleteInvoice = createAsyncThunk(
  "invoices/delete",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`/invoices/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to delete invoice");
    }
  }
);

export const fetchRecurringInvoices = createAsyncThunk(
  "recurringInvoices/fetch",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await axios.get("/recurring-invoices", { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to load recurring invoices");
    }
  }
);

export const createRecurringInvoice = createAsyncThunk(
  "recurringInvoices/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post("/recurring-invoices", payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to create recurring invoice");
    }
  }
);

export const updateRecurringInvoice = createAsyncThunk(
  "recurringInvoices/update",
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`/recurring-invoices/${id}`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to update recurring invoice");
    }
  }
);

export const deleteRecurringInvoice = createAsyncThunk(
  "recurringInvoices/delete",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`/recurring-invoices/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to delete recurring invoice");
    }
  }
);

export const generateRecurringInvoice = createAsyncThunk(
  "recurringInvoices/generate",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`/recurring-invoices/${id}/generate`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to generate invoice from recurring template");
    }
  }
);

const slice = createSlice({
  name: "invoices",
  initialState,
  reducers: {
    clearError(s) { s.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(fetchInvoices.pending, (s) => { s.loading = true; })
      .addCase(fetchInvoices.fulfilled, (s, a) => { s.items = a.payload.data; s.total = a.payload.total; s.loading = false; })
      .addCase(fetchInvoices.rejected, (s, a) => { s.error = a.payload; s.loading = false; })
      .addCase(createInvoice.fulfilled, (s, a) => { s.items.unshift(a.payload); })
      .addCase(createInvoice.rejected, (s, a) => { s.error = a.payload; })
      .addCase(updateInvoice.fulfilled, (s, a) => {
        s.items = s.items.map((p) => (p.id === a.payload.id ? a.payload : p));
      })
      .addCase(updateInvoice.rejected, (s, a) => { s.error = a.payload; })
      .addCase(updateInvoiceStatus.fulfilled, (s, a) => {
        s.items = s.items.map((p) => (p.id === a.payload.id ? a.payload : p));
      })
      .addCase(updateInvoiceStatus.rejected, (s, a) => { s.error = a.payload; })
      .addCase(deleteInvoice.fulfilled, (s, a) => { s.items = s.items.filter((p) => p.id !== a.payload); })
      .addCase(deleteInvoice.rejected, (s, a) => { s.error = a.payload; })
      .addCase(fetchRecurringInvoices.pending, (s) => { s.recurringLoading = true; })
      .addCase(fetchRecurringInvoices.fulfilled, (s, a) => { s.recurringItems = a.payload; s.recurringLoading = false; })
      .addCase(fetchRecurringInvoices.rejected, (s, a) => { s.error = a.payload; s.recurringLoading = false; })
      .addCase(createRecurringInvoice.fulfilled, (s, a) => { s.recurringItems.unshift(a.payload); })
      .addCase(createRecurringInvoice.rejected, (s, a) => { s.error = a.payload; })
      .addCase(updateRecurringInvoice.fulfilled, (s, a) => {
        s.recurringItems = s.recurringItems.map((p) => (p.id === a.payload.id ? a.payload : p));
      })
      .addCase(updateRecurringInvoice.rejected, (s, a) => { s.error = a.payload; })
      .addCase(deleteRecurringInvoice.fulfilled, (s, a) => { s.recurringItems = s.recurringItems.filter((p) => p.id !== a.payload); })
      .addCase(deleteRecurringInvoice.rejected, (s, a) => { s.error = a.payload; })
      .addCase(generateRecurringInvoice.fulfilled, (s, a) => { s.recurringItems = s.recurringItems.map((p) => (p.id === a.payload.id ? a.payload : p)); })
      .addCase(generateRecurringInvoice.rejected, (s, a) => { s.error = a.payload; });
  },
});

export const { clearError } = slice.actions;
export default slice.reducer;