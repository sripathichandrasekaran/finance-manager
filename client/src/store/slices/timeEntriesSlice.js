import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = { items: [], total: 0, summary: null, loading: false, error: null };

export const fetchTimeEntries = createAsyncThunk("timeEntries/fetch", async (params = {}) => {
  const { data, headers } = await axios.get("/time-entries", { params });
  return { data, total: Number(headers["x-total-count"] || data.length) };
});

export const createTimeEntry = createAsyncThunk("timeEntries/create", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await axios.post("/time-entries", payload);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || "Failed to create entry");
  }
});

export const updateTimeEntry = createAsyncThunk("timeEntries/update", async ({ id, ...payload }, { rejectWithValue }) => {
  try {
    const { data } = await axios.patch(`/time-entries/${id}`, payload);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || "Failed to update entry");
  }
});

export const deleteTimeEntry = createAsyncThunk("timeEntries/delete", async (id) => {
  await axios.delete(`/time-entries/${id}`);
  return id;
});

export const fetchTimeSummary = createAsyncThunk("timeEntries/summary", async (params = {}) => {
  const { data } = await axios.get("/time-entries/summary", { params });
  return data;
});

const slice = createSlice({
  name: "timeEntries",
  initialState,
  reducers: { clearError(s) { s.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchTimeEntries.pending, (s) => { s.loading = true; })
      .addCase(fetchTimeEntries.fulfilled, (s, a) => { s.items = a.payload.data; s.total = a.payload.total; s.loading = false; })
      .addCase(fetchTimeEntries.rejected, (s, a) => { s.error = a.payload; s.loading = false; })
      .addCase(createTimeEntry.fulfilled, (s, a) => { s.items.unshift(a.payload); })
      .addCase(updateTimeEntry.fulfilled, (s, a) => {
        s.items = s.items.map((e) => (e.id === a.payload.id ? a.payload : e));
      })
      .addCase(deleteTimeEntry.fulfilled, (s, a) => {
        s.items = s.items.filter((e) => e.id !== a.payload);
      })
      .addCase(fetchTimeSummary.fulfilled, (s, a) => { s.summary = a.payload; });
  },
});

export const { clearError } = slice.actions;
export default slice.reducer;
