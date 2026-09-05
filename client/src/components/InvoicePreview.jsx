import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import PrintIcon from "@mui/icons-material/PrintOutlined";
import CloseIcon from "@mui/icons-material/Close";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import StorefrontIcon from "@mui/icons-material/Storefront";

const STATUS_COLORS = {
  draft: "default",
  sent: "info",
  paid: "success",
  overdue: "error",
};

const fmt = (v) => `₹${Number(v || 0).toFixed(2)}`;

function locLine(city, state, pincode) {
  const base = [city, state].filter(Boolean).join(", ");
  return pincode ? `${base} ${pincode}`.trim() : base;
}

function partyLines(name, owner, address, location, gstin, contact) {
  const lines = [];
  if (name) lines.push(name);
  if (owner) lines.push(owner);
  if (address) lines.push(address);
  if (location) lines.push(location);
  if (gstin) lines.push(`GSTIN: ${gstin}`);
  if (contact) lines.push(contact);
  return lines;
}

export default function InvoicePreview({ invoice, company, seller, onClose, onPrint }) {
  if (!invoice) return null;

  const taxLabel =
    invoice.tax_type === "igst" ? "IGST" : "CGST + SGST";
  const hasGstBreakdown =
    Number(invoice.cgst_total || 0) > 0 ||
    Number(invoice.sgst_total || 0) > 0 ||
    Number(invoice.igst_total || 0) > 0;

  const sellerName = (seller && seller.business_name) || "Your business";
  const sellerBlock = partyLines(
    sellerName,
    seller?.owner_name,
    seller?.address,
    locLine(seller?.city, seller?.state, seller?.pincode),
    seller?.gstin,
    seller?.phone || seller?.email
  );

  const buyerBlock = partyLines(
    company?.name || "Client",
    null,
    company?.billing_address,
    locLine(company?.city, company?.state, company?.pincode),
    company?.gstin,
    company?.contact_email
  );

  const hasHsn = (invoice.items || []).some((it) => it.hsn_sac);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Typography sx={{ fontWeight: 650, fontSize: 16 }}>Invoice preview</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: "var(--fm-bg)" }}>
        <Box
          sx={{
            bgcolor: "var(--fm-bg-paper)",
            border: "1px solid var(--fm-card-border)",
            borderRadius: "var(--fm-radius-lg)",
            p: { xs: 2.5, sm: 4 },
            color: "var(--fm-text)",
          }}
        >
          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Box>
              <Typography sx={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--fm-primary)" }}>
                {sellerName}
              </Typography>
              <Typography sx={{ color: "var(--fm-text-subtle)", fontSize: 13 }}>Invoice</Typography>
            </Box>
            <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
              <Typography sx={{ fontWeight: 700 }}>{invoice.invoice_number}</Typography>
              <Chip
                size="small"
                color={STATUS_COLORS[invoice.status] || "default"}
                label={invoice.status || "draft"}
                sx={{ textTransform: "uppercase", mt: 0.5, mb: 1 }}
              />
              <Box sx={{ fontSize: 13, color: "var(--fm-text-secondary)" }}>
                <div>Issued: {invoice.issue_date || "\u2014"}</div>
                <div>Due: {invoice.due_date || "\u2014"}</div>
                {invoice.place_of_supply && <div>Place of supply: {invoice.place_of_supply}</div>}
                {invoice.tax_type && <div>Tax type: {taxLabel}</div>}
              </Box>
            </Box>
          </Box>

          <Box sx={{ height: "3px", bgcolor: "var(--fm-primary)", borderRadius: 2, my: 2.5 }} />

          {/* Parties */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 3,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 0.75 }}>
                <StorefrontIcon sx={{ fontSize: 15, color: "var(--fm-text-subtle)" }} /> From
              </Typography>
              {sellerBlock.map((l, i) => (
                <Typography key={i} sx={i === 0 ? { fontWeight: 600, color: "var(--fm-text-strong)" } : undefined}>
                  {l}
                </Typography>
              ))}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 0.75 }}>
                <LocalShippingOutlinedIcon sx={{ fontSize: 15, color: "var(--fm-text-subtle)" }} /> Bill to
              </Typography>
              {buyerBlock.map((l, i) => (
                <Typography key={i} sx={i === 0 ? { fontWeight: 600, color: "var(--fm-text-strong)" } : undefined}>
                  {l}
                </Typography>
              ))}
            </Box>
          </Box>

          {/* Line items */}
          <TableContainer sx={{ mt: 3, border: "1px solid var(--fm-card-border)", borderRadius: "var(--fm-radius-md)" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "var(--fm-primary-soft)" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Description</TableCell>
                  {hasHsn && <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>HSN/SAC</TableCell>}
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>Qty</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>Rate</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(invoice.items || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={hasHsn ? 5 : 4} align="center" sx={{ color: "var(--fm-text-subtle)", py: 3 }}>
                      No line items
                    </TableCell>
                  </TableRow>
                ) : (
                  (invoice.items || []).map((it) => (
                    <TableRow key={it.id} sx={{ "&:last-child td": { borderBottom: "none" } }}>
                      <TableCell sx={{ fontSize: 13 }}>{it.description}</TableCell>
                      {hasHsn && (
                        <TableCell sx={{ fontSize: 13, color: "var(--fm-text-subtle)" }}>{it.hsn_sac || "\u2014"}</TableCell>
                      )}
                      <TableCell align="right" sx={{ fontSize: 13 }}>{it.quantity}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>{fmt(it.unit_price)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 13, fontWeight: 600 }}>{fmt(it.total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Totals */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2.5 }}>
            <Box sx={{ minWidth: { xs: "100%", sm: 280 }, fontSize: 13 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                <span style={{ color: "var(--fm-text-secondary)" }}>Subtotal</span>
                <span>{fmt(invoice.subtotal)}</span>
              </Box>
              {hasGstBreakdown ? (
                <>
                  {Number(invoice.cgst_total || 0) > 0 && (
                    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                      <span style={{ color: "var(--fm-text-secondary)" }}>CGST</span>
                      <span>{fmt(invoice.cgst_total)}</span>
                    </Box>
                  )}
                  {Number(invoice.sgst_total || 0) > 0 && (
                    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                      <span style={{ color: "var(--fm-text-secondary)" }}>SGST</span>
                      <span>{fmt(invoice.sgst_total)}</span>
                    </Box>
                  )}
                  {Number(invoice.igst_total || 0) > 0 && (
                    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                      <span style={{ color: "var(--fm-text-secondary)" }}>IGST</span>
                      <span>{fmt(invoice.igst_total)}</span>
                    </Box>
                  )}
                </>
              ) : (
                Number(invoice.tax_rate || 0) > 0 && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                    <span style={{ color: "var(--fm-text-secondary)" }}>Tax ({invoice.tax_rate}%)</span>
                    <span>{fmt(invoice.tax)}</span>
                  </Box>
                )
              )}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  py: 0.75,
                  mt: 0.5,
                  borderTop: "2px solid var(--fm-text)",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                <span>Total</span>
                <span>{fmt(invoice.total)}</span>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                <span style={{ color: "var(--fm-text-secondary)" }}>Paid</span>
                <span style={{ color: "var(--fm-success)" }}>{fmt(invoice.paid_amount)}</span>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5, fontWeight: 700 }}>
                <span>Balance due</span>
                <span>{fmt(invoice.balance_due)}</span>
              </Box>
            </Box>
          </Box>

          {invoice.notes && (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>Notes</Typography>
              <Typography sx={{ fontSize: 13, color: "var(--fm-text-secondary)", whiteSpace: "pre-wrap" }}>
                {invoice.notes}
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid var(--fm-card-border)", textAlign: "center" }}>
            <Typography sx={{ fontSize: 12, color: "var(--fm-text-subtle)" }}>
              Generated by Finance Manager · Thank you for your business!
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={onPrint} sx={{ textTransform: "none" }}>
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
}