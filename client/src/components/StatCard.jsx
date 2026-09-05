import React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

export default function StatCard({
  title,
  value,
  currency = true,
  color = "var(--fm-text-primary)",
  icon,
  loading = false,
  sub,
}) {
  const formatted =
    currency && value != null ? `₹${Number(value).toFixed(2)}` : value != null ? value : "--";
  return (
    <Card sx={{ height: 100 }}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Typography
            sx={{
              color: "var(--fm-text-secondary)",
              fontWeight: 600,
              fontSize: "12px",
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
          {icon && (
            <Box
              sx={{
                color: "var(--fm-text-faint)",
                display: "flex",
                alignItems: "center",
                "& .MuiSvgIcon-root": { fontSize: 16 },
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
        <Typography
          sx={{
            color,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            fontSize: "25px",
            lineHeight: 1,
            mt: 1.5,
          }}
        >
          {loading ? <Skeleton width={110} /> : formatted}
        </Typography>
        {sub && !loading && (
          <Typography
            variant="caption"
            sx={{ color: "var(--fm-text-secondary)", mt: 0.75, display: "block", fontSize: "11px" }}
          >
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
