import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { pushNotification } from "../store/slices/notificationsSlice.js";
import { TOKEN_KEY } from "./api.js";

const HTTP_RE = /^(https?|ws|wss):\/\//;

function wsUrl() {
  let base = import.meta.env.VITE_API_URL || "";
  const token = (() => {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  })();
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  if (!base) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/notifications/ws${q}`;
  }
  const withProto = HTTP_RE.test(base) ? base : `http://${base}`;
  const wsBase = withProto.replace(/^http/, "ws");
  return `${wsBase.replace(/\/$/, "")}/api/notifications/ws${q}`;
}

let socket = null;
let reconnectTimer = null;
let trying = false;

function fireBrowserNotification(n) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const ntf = new Notification(n.title, {
      body: n.message || "",
      tag: `fm-notif-${n.id}`,
    });
    if (n.link) ntf.onclick = () => { window.focus(); window.location.hash = `#${n.link}`; };
  } catch (e) {
    /* ignore */
  }
}

function connect(dispatch) {
  if (trying) return;
  trying = true;
  try {
    socket = new WebSocket(wsUrl());
  } catch (e) {
    trying = false;
    scheduleReconnect(dispatch);
    return;
  }

  socket.onopen = () => {
    trying = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  socket.onmessage = (evt) => {
    let data;
    try {
      data = JSON.parse(evt.data);
    } catch (e) {
      return;
    }
    if (data.event === "notification.new" && data.id) {
      dispatch(pushNotification(data));
      fireBrowserNotification(data);
    } else if (data.event === "system") {
      fireBrowserNotification(data);
    }
  };

  socket.onclose = () => {
    trying = false;
    socket = null;
    scheduleReconnect(dispatch);
  };

  socket.onerror = () => {
    try { socket && socket.close(); } catch (e) { /* ignore */ }
  };
}

function scheduleReconnect(dispatch) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(dispatch);
  }, 3000);
}

export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export function useRealtimeNotifications() {
  const dispatch = useDispatch();
  useEffect(() => {
    connect(dispatch);
    requestNotificationPermission();
    return () => {
      if (socket) {
        try { socket.close(); } catch (e) { /* ignore */ }
        socket = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
