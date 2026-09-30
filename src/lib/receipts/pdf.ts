import "server-only";
import PDFDocument from "pdfkit";
import type { ReceiptSnapshot } from "./snapshot";

/**
 * Renders a receipt PDF entirely from the frozen snapshot, so regenerating a receipt
 * later always reproduces the same document even if prices or settings changed since.
 */
export async function renderReceiptPdf(s: ReceiptSnapshot): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Receipt ${s.receiptNumber}`, Author: s.property.name } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const brand = "#8b3a2f";
    const muted = "#6b625a";
    const money = (v: number) => `${s.currencySymbol}${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Header band
    doc.rect(0, 0, doc.page.width, 96).fill(brand);
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(22).text(s.property.name, 48, 30);
    doc.font("Helvetica").fontSize(10).text(s.property.addressLines.join(" · "), 48, 58, { width: 330 });
    doc.font("Helvetica-Bold").fontSize(16).text("RECEIPT", 380, 30, { width: 167, align: "right" });
    doc.font("Helvetica").fontSize(10).text(s.receiptNumber, 380, 52, { width: 167, align: "right" });
    doc.text(`Issued ${s.issuedAtDisplay}`, 380, 66, { width: 167, align: "right" });

    doc.fill("#1f1b16");
    let y = 120;

    // Two columns: guest / booking
    doc.font("Helvetica-Bold").fontSize(10).fillColor(muted).text("BILLED TO", 48, y);
    doc.text("BOOKING", 320, y);
    y += 14;
    doc.font("Helvetica").fontSize(11).fillColor("#1f1b16");
    doc.text(s.guest.name, 48, y);
    doc.text(`Reference: ${s.booking.reference}`, 320, y);
    y += 15;
    doc.fontSize(10).fillColor(muted).text(s.guest.email, 48, y);
    doc.fillColor("#1f1b16").text(`${s.booking.roomName}`, 320, y);
    y += 14;
    doc.fillColor(muted).text(s.guest.phone, 48, y);
    doc.fillColor("#1f1b16").text(`Check-in ${s.booking.checkIn} (${s.property.checkInTime})`, 320, y);
    y += 14;
    doc.text(`Check-out ${s.booking.checkOut} (${s.property.checkOutTime})`, 320, y);
    y += 14;
    doc.text(`${s.booking.nights} night${s.booking.nights === 1 ? "" : "s"} · ${s.booking.guestCount} guest${s.booking.guestCount === 1 ? "" : "s"}`, 320, y);
    y += 30;

    // Line items table
    const col = { desc: 48, qty: 330, unit: 400, amt: 480 };
    doc.rect(48, y - 6, 499, 22).fill("#f6f3ee");
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(9);
    doc.text("DESCRIPTION", col.desc + 6, y);
    doc.text("QTY", col.qty, y, { width: 60, align: "right" });
    doc.text("UNIT", col.unit, y, { width: 70, align: "right" });
    doc.text("AMOUNT", col.amt, y, { width: 67, align: "right" });
    y += 24;
    doc.font("Helvetica").fontSize(10).fillColor("#1f1b16");
    for (const item of s.lineItems) {
      doc.text(item.description, col.desc + 6, y, { width: 270 });
      doc.text(String(item.quantity), col.qty, y, { width: 60, align: "right" });
      doc.text(money(item.unitAmount), col.unit, y, { width: 70, align: "right" });
      doc.text(money(item.amount), col.amt, y, { width: 67, align: "right" });
      y += Math.max(16, doc.heightOfString(item.description, { width: 270 }) + 4);
    }
    y += 6;
    doc.moveTo(48, y).lineTo(547, y).strokeColor("#e5ddd2").stroke();
    y += 10;

    const totalsRow = (label: string, value: string, bold = false, color = "#1f1b16") => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor(bold ? color : muted).text(label, 330, y, { width: 130, align: "right" });
      doc.fillColor(color).text(value, 470, y, { width: 77, align: "right" });
      y += bold ? 20 : 16;
    };
    totalsRow("Room charges", money(s.totals.roomCharges));
    if (s.totals.additionalCharges > 0) totalsRow("Additional charges", money(s.totals.additionalCharges));
    if (s.totals.discount > 0) totalsRow("Discount", `- ${money(s.totals.discount)}`);
    if (s.totals.taxAmount > 0) totalsRow(`${s.totals.taxLabel} (${s.totals.taxRate}%)`, money(s.totals.taxAmount));
    totalsRow("Total", money(s.totals.totalAmount), true, brand);
    totalsRow("Paid", money(s.totals.amountPaid));
    if (s.totals.balanceDue > 0) totalsRow("Balance due", money(s.totals.balanceDue), true, "#b45309");
    else totalsRow("Balance due", money(0));

    y += 14;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(muted).text("PAYMENTS", 48, y);
    y += 14;
    doc.font("Helvetica").fontSize(10).fillColor("#1f1b16");
    if (s.payments.length === 0) {
      doc.text("No payments recorded.", 48, y);
      y += 14;
    }
    for (const p of s.payments) {
      doc.text(`${p.date} · ${p.methodLabel}${p.reference ? ` · Ref ${p.reference}` : ""}`, 48, y, { width: 380 });
      doc.text(money(p.amount), 470, y, { width: 77, align: "right" });
      y += 14;
    }

    y += 20;
    doc.fontSize(9).fillColor(muted).text(`Payment status: ${s.paymentStatusLabel}. ${s.footerNote}`, 48, y, { width: 499 });
    y += 30;
    doc.text(`${s.property.name}${s.property.phone ? ` · ${s.property.phone}` : ""}${s.property.email ? ` · ${s.property.email}` : ""}${s.property.website ? ` · ${s.property.website}` : ""}`, 48, y, { width: 499, align: "center" });
    doc.text("This is a computer-generated receipt and does not require a signature.", 48, y + 14, { width: 499, align: "center" });

    doc.end();
  });
}
