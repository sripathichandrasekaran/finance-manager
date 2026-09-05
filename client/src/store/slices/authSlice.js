import api, { setToken, TOKEN_KEY } from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  token: "",
  username: "",
  authEnabled: false,
  status: "idle", // idle | loading | authenticated | unauthenticated
  sessions: [],
  sessionsTotal: 0,
  error: null,
};

export const login = createAsyncThunk(
  "auth/login",
  async ({ password, username } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/login", { password, username });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Login failed");
    }
  }
);

export const initializeAuth = createAsyncThunk(
  "auth/init",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const stored = (() => {
        try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
      })();
      if (stored) {
        const { data } = await api.get("/auth/me");
        return { token: stored, username: data.username, authEnabled: data.auth_enabled };
      }
      const { data } = await api.post("/auth/login", { password: "" });
      return { token: data.token, username: data.username, authEnabled: data.auth_enabled };
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Not authenticated");
    }
  }
);

export const logout = createAsyncThunk("auth/logout", async () => {
  try { await api.post("/auth/logout"); } catch (e) { /* ignore */ }
  setToken("");
  return {};
});

export const fetchSessions = createAsyncThunk(
  "auth/sessions",
  async (page = 1, { rejectWithValue }) => {
    try {
      const { data, headers } = await api.get("/auth/sessions", {
        params: { page, page_size: 50 },
      });
      return { data, total: Number(headers["x-total-count"] || data.length) };
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to load sessions");
    }
  }
);

export const revokeSession = createAsyncThunk(
  "auth/revokeSession",
  async (id, { rejectWithValue }) => {
    try {
      await api.post(`/auth/sessions/${id}/revoke`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Failed to revoke session");
    }
  }
);

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError(s) { s.error = null; },
    setUnauthenticated(s) { s.status = "unauthenticated"; s.token = ""; },
  },
  extraReducers: (b) => {
    b.addCase(initializeAuth.pending, (s) => { s.status = "loading"; })
      .addCase(initializeAuth.fulfilled, (s, a) => {
        s.token = a.payload.token;
        s.username = a.payload.username;
        s.authEnabled = a.payload.authEnabled;
        s.status = "authenticated";
        setToken(a.payload.token);
      })
      .addCase(initializeAuth.rejected, (s) => { s.status = "unauthenticated"; })
      .addCase(login.pending, (s) => { s.status = "loading"; s.error = null; })
      .addCase(login.fulfilled, (s, a) => {
        s.token = a.payload.token;
        s.username = a.payload.username;
        s.authEnabled = a.payload.authEnabled;
        s.status = "authenticated";
        setToken(a.payload.token);
      })
      .addCase(login.rejected, (s, a) => { s.status = "unauthenticated"; s.error = a.payload; })
      .addCase(logout.fulfilled, (s) => { s.token = ""; s.username = ""; s.status = "unauthenticated"; })
      .addCase(fetchSessions.fulfilled, (s, a) => { s.sessions = a.payload.data; s.sessionsTotal = a.payload.total; })
      .addCase(fetchSessions.rejected, (s, a) => { s.error = a.payload; })
      .addCase(revokeSession.fulfilled, (s, a) => {
        s.sessions = s.sessions.map((x) =>
          x.id === a.payload ? { ...x, active: false } : x
        );
      });
  },
});

export const { clearError, setUnauthenticated } = slice.actions;
export default slice.reducer;
