import { createTheme } from "@mui/material/styles";
import { colorTokens, cssVars, darkColorTokens, darkCssVars } from "./tokens";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function buildPalette(mode, tokens) {
  return {
    mode,
    primary: {
      main: tokens.primary,
      dark: tokens["primary-deep"],
      light: tokens["primary-hover"],
      contrastText: tokens["on-primary"],
    },
    secondary: {
      main: tokens["text-muted"],
      contrastText: tokens["bg-paper"],
    },
    error: { main: tokens.danger, contrastText: "#FFFFFF" },
    warning: { main: tokens.warning },
    success: { main: tokens.success },
    info: { main: tokens.primary },
    background: {
      default: tokens.bg,
      paper: tokens["bg-paper"],
    },
    text: {
      primary: tokens["text-primary"],
      secondary: tokens["text-soft"],
      disabled: tokens["text-disabled"],
    },
    divider: tokens["black-08"],
  };
}

const typographyScale = {
  fontFamily: '"Inter", "Manrope", system-ui, -apple-system, sans-serif',
  h4: { fontWeight: 700, fontSize: "1.5rem", letterSpacing: "-0.025em", lineHeight: 1.2 },
  h5: { fontWeight: 650, fontSize: "1.125rem", letterSpacing: "-0.02em" },
  h6: { fontWeight: 650, fontSize: "1rem", letterSpacing: "-0.01em" },
  subtitle1: { fontWeight: 650, fontSize: "0.9375rem" },
  subtitle2: { fontWeight: 600, fontSize: "0.875rem" },
  body1: { fontSize: "0.875rem", lineHeight: 1.6 },
  body2: { fontSize: "0.8125rem", lineHeight: 1.5 },
  caption: { fontSize: "0.6875rem", lineHeight: 1.4, letterSpacing: "0.01em" },
  button: { fontWeight: 600, letterSpacing: "0.01em" },
};

export const pageTitle = {
  fontWeight: 700,
  fontSize: "1.75rem",
  letterSpacing: "-0.025em",
  lineHeight: 1.15,
};

function buildShadowRamp() {
  return [
    "none",
    "0 1px 2px rgba(0,0,0,0.03)",
    "0 1px 3px rgba(0,0,0,0.04)",
    "0 2px 6px rgba(0,0,0,0.05)",
    "0 4px 12px rgba(0,0,0,0.06)",
    ...Array.from({ length: 21 }, () => "0 4px 12px rgba(0,0,0,0.06)"),
  ];
}

function baseline(vars) {
  return {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": vars,
        "*": { boxSizing: "border-box" },
        html: { WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" },
        body: {
          backgroundColor: "var(--fm-bg)",
          color: "var(--fm-text-primary)",
          fontFamily: '"Inter", "Manrope", system-ui, sans-serif',
        },
        "::-webkit-scrollbar": { width: 6, height: 6 },
        "::-webkit-scrollbar-track": { background: "transparent" },
        "::-webkit-scrollbar-thumb": { background: "var(--fm-scrollbar)", borderRadius: 8 },
        "::selection": { background: "var(--fm-primary)", color: "var(--fm-on-primary)" },
      },
    },
  };
}

function surfaces() {
  return {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          border: "1px solid var(--fm-card-border)",
          borderRadius: "var(--fm-radius-md)",
          backgroundImage: "none",
          backgroundColor: "var(--fm-surface)",
          overflow: "hidden",
          transition: "border-color 0.2s",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: "var(--fm-radius-md)" },
        rounded: { borderRadius: "var(--fm-radius-md)" },
        elevation0: { boxShadow: "none" },
        elevation1: { boxShadow: "none" },
        elevation2: { boxShadow: "none" },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: "var(--fm-border)" } } },
  };
}

function actions() {
  return {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 8,
          fontSize: "0.8125rem",
          letterSpacing: 0,
          padding: "0 16px",
          height: 38,
          transition: `transform 0.18s ${EASE}, box-shadow 0.18s, background-color 0.18s, border-color 0.18s, color 0.18s`,
          "&:active": { transform: "translateY(0)" },
          "&:focus-visible": { outline: "2px solid var(--fm-primary-a30)", outlineOffset: 2 },
        },
        sizeSmall: { height: 32, fontSize: "0.75rem", padding: "0 12px", borderRadius: 7 },
        sizeLarge: { height: 44, fontSize: "0.875rem", padding: "0 20px", borderRadius: 9 },

        containedPrimary: {
          color: "var(--fm-on-primary)",
          backgroundColor: "var(--fm-primary)",
          boxShadow: "none",
          "&:hover": {
            backgroundColor: "var(--fm-primary-hover)",
            boxShadow: "0 2px 8px var(--fm-primary-a30)",
            color: "var(--fm-on-primary)",
          },
          "&.Mui-disabled": {
            backgroundColor: "var(--fm-primary-a12)",
            color: "var(--fm-text-soft)",
          },
        },
        containedSecondary: {
          backgroundColor: "var(--fm-surface-secondary)",
          color: "var(--fm-text-primary)",
          "&:hover": { backgroundColor: "var(--fm-bg-hover)", color: "var(--fm-text-primary)" },
        },
        outlined: {
          color: "var(--fm-text-primary)",
          borderColor: "var(--fm-black-12)",
          "&:hover": { backgroundColor: "var(--fm-primary-soft)", borderColor: "var(--fm-primary)" },
        },
        text: {
          color: "var(--fm-text-primary)",
          "&:hover": { backgroundColor: "var(--fm-bg-hover)" },
          "&.Mui-disabled": { color: "var(--fm-text-faint)" },
        },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 8, transition: "background-color 0.18s" } } },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.8125rem",
          minHeight: 38,
          transition: "color 0.18s",
        },
      },
    },
  };
}

function forms() {
  return {
    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            fontSize: "0.8125rem",
            backgroundColor: "var(--fm-bg-soft)",
            height: 40,
            transition: "border-color 0.18s, background-color 0.18s",
            "& fieldset": { borderColor: "var(--fm-border)" },
            "&:hover fieldset": { borderColor: "var(--fm-black-20)" },
            "&.Mui-focused fieldset": { borderColor: "var(--fm-primary)", borderWidth: 1.5 },
            "&.Mui-focused": { backgroundColor: "var(--fm-surface)" },
          },
          "& .MuiInputLabel-root": { transform: "translate(14px, 11px) scale(1)" },
          "& .MuiInputLabel-shrink": { transform: "translate(14px, -9px) scale(0.75)", transformOrigin: "top left" },
        },
      },
    },
    MuiSelect: { styleOverrides: { root: { borderRadius: 8, fontSize: "0.8125rem" } } },
    MuiInputLabel: { styleOverrides: { root: { fontSize: "0.8125rem" } } },
  };
}

function dataDisplay() {
  return {
    MuiTableContainer: {
      styleOverrides: { root: { overflowX: "auto" } },
    },
    MuiTablePagination: {
      styleOverrides: {
        toolbar: { justifyContent: "flex-start" },
        spacer: { flex: "none" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 600, fontSize: "0.6875rem", height: 24 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: "1px solid var(--fm-black-04)", padding: "10px 16px", whiteSpace: "nowrap" },
        head: {
          fontWeight: 700,
          fontSize: "0.6875rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--fm-text-soft)",
          borderBottom: "1px solid var(--fm-border)",
          padding: "10px 16px",
        },
        body: { fontSize: "0.8125rem" },
      },
    },
  };
}

function feedback() {
  return {
    MuiAlert: { styleOverrides: { root: { borderRadius: 8, fontSize: "0.8125rem" } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          backgroundColor: "var(--fm-surface)",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: 6, fontSize: "0.6875rem", padding: "5px 10px" },
      },
    },
  };
}

export function getTheme(mode) {
  const tokens = mode === "dark" ? darkColorTokens : colorTokens;
  const vars = mode === "dark" ? darkCssVars : cssVars;
  return createTheme({
    palette: buildPalette(mode, tokens),
    typography: typographyScale,
    shape: { borderRadius: 10 },
    shadows: buildShadowRamp(),
    components: {
      ...baseline(vars),
      ...surfaces(),
      ...actions(),
      ...forms(),
      ...dataDisplay(),
      ...feedback(),
    },
  });
}
