import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  total: 0,
  loading: false,
  error: null,
};

export const fetchReminders = createAsyncThunk("reminders/fetch", async (params = {}) => {
  const { data, headers } = await axios.get("/reminders/all", { params });
  return { data, total: Number(headers["x-total-count"] || data.length) };
});

export const dismissReminder = createAsyncThunk(
  "reminders/dismiss",
  async (id) => {
    const { data } = await axios.patch(`/reminders/${id}/status`, { status: "dismissed" });
    return data;
  }
);

export const deleteReminder = createAsyncThunk("reminders/delete", async (id) => {
  await axios.delete(`/reminders/${id}`);
  return id;
});

const remindersSlice = createSlice({
  name: "reminders",
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReminders.pending, (state) => { state.loading = true; })
      .addCase(fetchReminders.fulfilled, (state, action) => { state.items = action.payload.data; state.total = action.payload.total; state.loading = false; })
      .addCase(fetchReminders.rejected, (state, action) => { state.error = action.payload; state.loading = false; })
      .addCase(dismissReminder.fulfilled, (state, action) => {
        state.items = state.items.filter((r) => r.id !== action.payload.id);
      })
      .addCase(deleteReminder.fulfilled, (state, action) => {
        state.items = state.items.filter((r) => r.id !== action.payload);
      });
  },
});

export const { clearError } = remindersSlice.actions;
export default remindersSlice.reducer;
