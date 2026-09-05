import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function EmptyState({ icon, title, subtitle, dense = false }) {
  return (
    <Box
      sx={{
        py: dense ? 3.5 : 5,
        px: 2,
        textAlign: "center",
        maxWidth: 440,
        mx: "auto",
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: "var(--fm-bg-soft)",
            color: "var(--fm-text-faint)",
            mb: 1.25,
            mx: "auto",
          }}
        >
          {icon}
        </Box>
      )}
      <Typography variant="body1" sx={{ color: "var(--fm-text-primary)", fontWeight: 600 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" sx={{ color: "var(--fm-text-secondary)", mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}