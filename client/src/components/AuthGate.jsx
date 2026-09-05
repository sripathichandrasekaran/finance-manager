import React from "react";
import { useDispatch, useSelector } from "react-redux";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Login from "../pages/Login.jsx";
import { initializeAuth } from "../store/slices/authSlice.js";

export default function AuthGate({ children }) {
  const dispatch = useDispatch();
  const { status } = useSelector((s) => s.auth);

  React.useEffect(() => {
    if (status === "idle") dispatch(initializeAuth());
  }, [status, dispatch]);

  if (status === "idle" || status === "loading") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: "var(--fm-bg)",
        }}
      >
        <CircularProgress size={28} sx={{ color: "var(--fm-brand, #5B4BD4)" }} />
      </Box>
    );
  }

  if (status === "unauthenticated") {
    return <Login />;
  }

  return children;
}
