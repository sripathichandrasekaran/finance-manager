import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { pageTitle } from "../theme/theme.js";

export default function PageHeader({ title, description, actions, sx }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: 2,
        mb: 2.5,
        ...sx,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          sx={{
            fontWeight: 700,
            fontSize: "28px",
            letterSpacing: "-0.025em",
            lineHeight: 1.15,
            mb: 0.5,
          }}
        >
          {title}
        </Typography>
        {description && (
          <Typography
            variant="body2"
            sx={{ color: "var(--fm-text-secondary)", fontSize: "13px", mt: 0.25 }}
          >
            {description}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>{actions}</Box>}
    </Box>
  );
}
