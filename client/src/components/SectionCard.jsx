import React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export default function SectionCard({ title, action, children, sx, contentSx }) {
  return (
    <Card sx={{ height: "100%", ...sx }}>
      <CardContent sx={{ p: "18px 20px", ...contentSx }}>
        {(title || action) && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            {title && (
              <Typography
                sx={{
                  fontWeight: 650,
                  fontSize: "14px",
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </Typography>
            )}
            {action}
          </Box>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
