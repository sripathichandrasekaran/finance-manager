import React from "react";
import { useDispatch, useSelector } from "react-redux";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import LockIcon from "@mui/icons-material/Lock";
import { login } from "../store/slices/authSlice.js";

function BrandMark() {
  return (
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: "14px",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #5B4BD4 0%, #8D7BF0 100%)",
        color: "#FFFFFF",
        mb: 2,
        mx: "auto",
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="14" width="4" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
        <rect x="10" y="9" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.7" />
        <rect x="17" y="3" width="4" height="18" rx="1.5" fill="currentColor" />
        <path d="M4.5 13L11.5 8L17.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
      </svg>
    </Box>
  );
}

export default function Login() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.auth);
  const [password, setPassword] = React.useState("");
  const busy = status === "loading";

  const submit = (e) => {
    e.preventDefault();
    dispatch(login({ password }));
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "var(--fm-bg)",
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        component="form"
        onSubmit={submit}
        sx={{
          width: "100%",
          maxWidth: 400,
          p: { xs: 3, sm: 4 },
          borderRadius: "var(--fm-radius-lg, 16px)",
          border: "1px solid var(--fm-border)",
          bgcolor: "var(--fm-surface)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
        }}
      >
        <BrandMark />
        <Typography
          sx={{
            textAlign: "center",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--fm-text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          Welcome back
        </Typography>
        <Typography
          sx={{
            textAlign: "center",
            color: "var(--fm-text-secondary)",
            fontSize: 13,
            mt: 0.5,
            mb: 3,
          }}
        >
          Sign in to Finance Manager
        </Typography>

        <TextField
          fullWidth
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          size="small"
          sx={{ mb: 2 }}
          inputProps={{ "aria-label": "password" }}
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>
            {error}
          </Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <LockIcon />}
          sx={{ py: 1.2, fontSize: 14 }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </Paper>
    </Box>
  );
}
