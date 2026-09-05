import axios from "../../services/api.js";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = { items: [], unread: 0, loading: false, error: null };

export const fetchNotifications = createAsyncThunk("notifications/fetch", async (limit = 50) => {
  const { data, headers } = await axios.get("/notifications", { params: { limit } });
  return { data, total: Number(headers["x-total-count"] || data.length) };
});

export const fetchUnreadCount = createAsyncThunk("notifications/unreadCount", async () => {
  const { data } = await axios.get("/notifications/unread-count");
  return data.count;
});

export const markRead = createAsyncThunk("notifications/markRead", async (id) => {
  const { data } = await axios.patch(`/notifications/${id}/read`);
  return data;
});

export const markAllRead = createAsyncThunk("notifications/markAllRead", async () => {
  const { data } = await axios.patch("/notifications/read-all");
  return data;
});

const slice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    pushNotification(s, a) {
      const n = a.payload;
      s.items = [n, ...s.items.filter((x) => x.id !== n.id)].slice(0, 100);
      if (!n.read) s.unread += 1;
    },
    clearError(s) { s.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(fetchNotifications.pending, (s) => { s.loading = true; })
      .addCase(fetchNotifications.fulfilled, (s, a) => {
        const data = a.payload.data || a.payload;
        s.items = data;
        s.unread = data.filter((n) => !n.read).length;
        s.loading = false;
      })
      .addCase(fetchNotifications.rejected, (s, a) => { s.error = a.payload; s.loading = false; })
      .addCase(fetchUnreadCount.fulfilled, (s, a) => { s.unread = a.payload; })
      .addCase(markRead.fulfilled, (s, a) => {
        const n = a.payload;
        const prev = s.items.find((x) => x.id === n.id);
        if (prev && !prev.read && n.read) s.unread = Math.max(0, s.unread - 1);
        s.items = s.items.map((x) => (x.id === n.id ? n : x));
      })
      .addCase(markAllRead.fulfilled, (s) => { s.unread = 0; });
  },
});

export const { pushNotification, clearError } = slice.actions;
export default slice.reducer;
