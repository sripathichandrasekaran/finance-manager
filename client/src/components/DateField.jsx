import React from "react";
import DatePicker from "react-multi-date-picker";
import CalendarIcon from "@mui/icons-material/CalendarMonth";

const FMT = "YYYY-MM-DD";

/**
 * Date input built on `react-multi-date-picker` that matches the MUI text-field
 * look. Works with plain `YYYY-MM-DD` string values (and `YYYY-MM-DD` string
 * arrays for `range`), so it drops straight into formik/state forms.
 *
 * Props:
 *  - label, value (string), onChange (string)
 *  - range: truthy -> value is [start, end] (strings), onChange([.., ..])
 *  - fullWidth, size, required, placeholder
 */
export default function DateField({
  label = "",
  value,
  onChange,
  range = false,
  fullWidth = false,
  size = "small",
  placeholder = "Select date",
  error = false,
  helperText,
  disabled = false,
  sx = {},
}) {
  const parseSingle = (v) => (v ? new DatePicker.DateObject(v) : undefined);
  const parseArray = (v) =>
    Array.isArray(v) ? v.map((d) => (d ? new DatePicker.DateObject(d) : null)) : [];

  const toSingle = (val) => (val ? val.format(FMT) : "");
  const toArray = (val) =>
    Array.isArray(val) ? val.map((d) => (d ? d.format(FMT) : "")).slice(0, 2) : ["", ""];

  const selected = range ? parseArray(value) : parseSingle(value);
  const valueProp = range ? selected.filter(Boolean) : selected;

  return (
    <div style={{ width: fullWidth ? "100%" : undefined }}>
      <DatePicker
        value={valueProp}
        onChange={(val) => {
          if (range) {
            const arr = Array.isArray(val) ? toArray(val) : ["", ""];
            onChange(arr);
          } else {
            onChange(toSingle(val));
          }
        }}
        range={range}
        rangeHover
        format={FMT}
        placeholder={placeholder}
        editable={false}
        disabled={disabled}
        render={(_, openCalendar) => (
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
            onClick={disabled ? undefined : openCalendar}
          >
            <div
              onClick={disabled ? undefined : openCalendar}
              style={{
                flex: 1,
                border: "1px solid var(--fm-card-border, rgba(0,0,0,0.23))",
                borderRadius: 6,
                paddingTop: size === "small" ? 8 : 16,
                paddingBottom: size === "small" ? 8 : 16,
                paddingLeft: 12,
                paddingRight: 36,
                fontSize: size === "small" ? 14 : 16,
                color: "var(--fm-text-primary)",
                cursor: "pointer",
                background: disabled ? "var(--fm-bg-hover, rgba(0,0,0,0.04))" : "transparent",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {range
                ? value?.[0]
                  ? `${value[0]}  →  ${value[1] || "..."}`
                  : placeholder
                : value || placeholder}
            </div>
            {label && (
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: 0,
                  fontSize: 11,
                  color: "var(--fm-text-secondary)",
                  background: "var(--fm-surface, #fff)",
                  padding: "0 4px",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                {label}
              </span>
            )}
            <span
              style={{
                position: "absolute",
                right: 10,
                display: "flex",
                color: "var(--fm-text-secondary)",
                pointerEvents: "none",
              }}
            >
              <CalendarIcon sx={{ fontSize: size === "small" ? 17 : 20 }} />
            </span>
          </div>
        )}
      />
      {helperText && (
        <div
          style={{
            fontSize: 12,
            color: error ? "var(--fm-danger)" : "var(--fm-text-secondary)",
            marginTop: 4,
            marginLeft: 14,
          }}
        >
          {helperText}
        </div>
      )}
    </div>
  );
}