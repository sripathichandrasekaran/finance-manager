import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  total: 0,
  stats: {
    total: 0, new: 0, applied: 0, replied: 0, won: 0, lost: 0, ignored: 0, drafted: 0,
  },
  loading: false,
  refreshing: false,
  drafting: false,
  error: null,
};

export const fetchOpportunities = createAsyncThunk("opportunities/fetch", async (params = {}) => {
  const { data, headers } = await axios.get("/opportunities", { params });
  return { data, total: Number(headers["x-total-count"] || data.length) };
});

export const fetchOpportunityStats = createAsyncThunk("opportunities/stats", async () => {
  const { data } = await axios.get("/opportunities/stats");
  return data;
});

export const refreshRadar = createAsyncThunk("opportunities/refresh", async (_, { rejectWithValue }) => {
  try {
    const { data } = await axios.post("/opportunities/refresh");
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || "Refresh failed");
  }
});

export const updateOpportunity = createAsyncThunk(
  "opportunities/update",
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`/opportunities/${id}`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Update failed");
    }
  }
);

export const deleteOpportunity = createAsyncThunk("opportunities/delete", async (id) => {
  await axios.delete(`/opportunities/${id}`);
  return id;
});

export const draftProposal = createAsyncThunk(
  "opportunities/draft",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`/opportunities/${id}/draft`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Draft failed");
    }
  }
);

export const markWon = createAsyncThunk(
  "opportunities/won",
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`/opportunities/${id}/won`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to mark as won");
    }
  }
);

const opportunitiesSlice = createSlice({
  name: "opportunities",
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOpportunities.pending, (state) => { state.loading = true; })
      .addCase(fetchOpportunities.fulfilled, (state, action) => {
        state.items = action.payload.data;
        state.total = action.payload.total;
        state.loading = false;
      })
      .addCase(fetchOpportunities.rejected, (state, action) => { state.error = action.payload; state.loading = false; })
      .addCase(fetchOpportunityStats.fulfilled, (state, action) => { state.stats = action.payload; })
      .addCase(refreshRadar.pending, (state) => { state.refreshing = true; })
      .addCase(refreshRadar.fulfilled, (state) => { state.refreshing = false; })
      .addCase(refreshRadar.rejected, (state, action) => { state.error = action.payload; state.refreshing = false; })
      .addCase(updateOpportunity.fulfilled, (state, action) => {
        state.items = state.items.map((o) => (o.id === action.payload.id ? action.payload : o));
      })
      .addCase(updateOpportunity.rejected, (state, action) => { state.error = action.payload; })
      .addCase(deleteOpportunity.fulfilled, (state, action) => {
        state.items = state.items.filter((o) => o.id !== action.payload);
      })
      .addCase(draftProposal.pending, (state) => { state.drafting = true; })
      .addCase(draftProposal.fulfilled, (state, action) => {
        state.items = state.items.map((o) => (o.id === action.payload.id ? action.payload : o));
        state.drafting = false;
      })
      .addCase(draftProposal.rejected, (state, action) => { state.error = action.payload; state.drafting = false; })
      .addCase(markWon.fulfilled, (state, action) => {
        state.items = state.items.map((o) => (o.id === action.payload.id ? action.payload : o));
      })
      .addCase(markWon.rejected, (state, action) => { state.error = action.payload; });
  },
});

export const { clearError } = opportunitiesSlice.actions;
export default opportunitiesSlice.reducer;