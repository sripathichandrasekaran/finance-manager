import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  total: 0,
  loading: false,
  error: null,
};

export const fetchSubscriptions = createAsyncThunk(
  "subscriptions/fetch",
  async (active = false, params = {}) => {
    const { data, headers } = await axios.get("/subscriptions", {
      params: { ...(active ? { active: true } : {}), ...params },
    });
    return { data, total: Number(headers["x-total-count"] || data.length) };
  }
);

export const createSubscription = createAsyncThunk(
  "subscriptions/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await axios.post("/subscriptions", payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to create subscription");
    }
  }
);

export const updateSubscription = createAsyncThunk(
  "subscriptions/update",
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`/subscriptions/${id}`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to update subscription");
    }
  }
);

export const deleteSubscription = createAsyncThunk(
  "subscriptions/delete",
  async (id) => {
    await axios.delete(`/subscriptions/${id}`);
    return id;
  }
);

const subscriptionsSlice = createSlice({
  name: "subscriptions",
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubscriptions.pending, (state) => { state.loading = true; })
      .addCase(fetchSubscriptions.fulfilled, (state, action) => { state.items = action.payload.data; state.total = action.payload.total; state.loading = false; })
      .addCase(fetchSubscriptions.rejected, (state, action) => { state.error = action.payload; state.loading = false; })
      .addCase(createSubscription.fulfilled, (state, action) => { state.items.unshift(action.payload); })
      .addCase(createSubscription.rejected, (state, action) => { state.error = action.payload; })
      .addCase(updateSubscription.fulfilled, (state, action) => {
        state.items = state.items.map((s) => (s.id === action.payload.id ? action.payload : s));
      })
      .addCase(deleteSubscription.fulfilled, (state, action) => {
        state.items = state.items.filter((s) => s.id !== action.payload);
      });
  },
});

export const { clearError } = subscriptionsSlice.actions;
export default subscriptionsSlice.reducer;
