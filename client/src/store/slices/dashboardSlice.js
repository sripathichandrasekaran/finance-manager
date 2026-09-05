import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  stats: null,
  loading: false,
  error: null,
};

export const fetchStats = createAsyncThunk("dashboard/stats", async ({ year, month } = {}) => {
  const { data } = await axios.get("/dashboard/stats", { params: { year, month } });
  return data;
});

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStats.pending, (state) => { state.loading = true; })
      .addCase(fetchStats.fulfilled, (state, action) => { state.stats = action.payload; state.loading = false; })
      .addCase(fetchStats.rejected, (state, action) => { state.error = action.payload; state.loading = false; });
  },
});

export const { clearError } = dashboardSlice.actions;
export default dashboardSlice.reducer;
