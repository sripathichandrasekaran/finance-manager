import axios from "axios";

const BASE_URL = (import.meta.env.VITE_API_URL || "") + "/api";

export const TOKEN_KEY = "fm_token";

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch (e) {
    return "";
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    /* ignore */
  }
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

let _store = null;
export function bindApiStore(store) {
  _store = store;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      setToken("");
      _store?.dispatch({ type: "auth/setUnauthenticated" });
    }
    return Promise.reject(err);
  }
);

export default api;
