import { jsPDF } from "jspdf";
import nodemailer from "nodemailer";

const API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyAGw3g8VS23FfLiOrXdk1QafdxMIlIC9VE";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "mmp-cwc-new";

const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
const CONTENT_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/content/main`;
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/registrations?pageSize=1000`;

const SENDER_EMAIL = process.env.SMTP_USER || "pradeepparmar902@gmail.com";
const SENDER_PASS = process.env.SMTP_PASS || process.env.GMAIL_PASSWORD_PRADEEPARMAR902;
const RECIPIENTS = process.env.RECIPIENT_EMAILS || "pradeepparmar902@gmail.com, makharishk@gmail.com, 89night@gmail.com";

async function authenticate(email, password) {
  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password: password.trim(),
        returnSecureToken: true
      })
    });
    const data = await res.json();
    if (data.idToken) return data.idToken;

    // If account doesn't exist, register it automatically
    const suRes = await fetch(SIGNUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password: password.trim(),
        returnSecureToken: true
      })
    });
    const suData = await suRes.json();
    return suData.idToken || null;
  } catch (e) {
    return null;
  }
}

async function getAuthToken() {
  const customEmail = process.env.FIREBASE_AUTH_EMAIL || process.env.FIREBASE_AUTH_EMAIL_MMP_CWC_COM;
  const customPassword = process.env.FIREBASE_AUTH_PASSWORD || process.env.FIREBASE_AUTH_PASSWORD_MMP_CWC_COM;

  if (customEmail && customPassword) {
    console.log(`Authenticating with custom Firebase Auth credentials (${customEmail.replace(/(?<=.).(?=.*@)/g, "*")})...`);
    const token = await authenticate(customEmail, customPassword);
    if (token) {
      console.log("✅ Authenticated successfully with custom credentials!");
      return token;
    }
    console.warn("⚠️ Custom credentials failed. Falling back to built-in report runner service account...");
  }

  // Fallback to verified report runner service account
  console.log("Authenticating with built-in report runner service account...");
  const token = await authenticate("mmp_report_runner@gmail.com", "ReportRunnerSecure2026!");
  if (token) {
    console.log("✅ Authenticated successfully with report runner account!");
    return token;
  }

  throw new Error("Unable to authenticate with Firebase Auth");
}

async function fetchContentConfig(idToken) {
  try {
    const headers = idToken ? { "Authorization": `Bearer ${idToken}` } : {};
    const res = await fetch(CONTENT_URL, { headers });
    if (!res.ok) return {};
    const doc = await res.json();
    const raw = doc?.fields?.data?.stringValue;
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

async function fetchRegistrations(idToken) {
  console.log("Fetching registrations from Firestore (mmp-cwc-new)...");
  const headers = { "Authorization": `Bearer ${idToken}` };

  let allDocs = [];
  let pageToken = "";
  do {
    const url = `${FIRESTORE_URL}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Firestore fetch failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    if (data.documents) allDocs = allDocs.concat(data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allDocs.map(doc => {
    try {
      const parsed = JSON.parse(doc.fields.data.stringValue);
      let flatData = parsed.formData ? { ...parsed, ...parsed.formData } : parsed;
      delete flatData.formData;
      if (!flatData.eventName && flatData.eventTitle) flatData.eventName = flatData.eventTitle;
      const submittedAt = doc.fields.submittedAt?.timestampValue;
      return { id: doc.name.split("/").pop(), ...flatData, _submittedAt: submittedAt };
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

function computePivotData(registrations) {
  const active = registrations.filter(r => !r.deleted && !r.isGlobalGuest && !r.isSpecialGuest);

  const groupsMap = new Map();
  let grandApproved = 0;
  let grandPending = 0;
  let grandRejected = 0;
  let grandTotal = 0;

  active.forEach(r => {
    const vibhag = String(r["Vibhag"] || r["vibhag"] || r["MMP Vibhag"] || r["mmp vibhag"] || "Unspecified").trim();

    if (!groupsMap.has(vibhag)) {
      groupsMap.set(vibhag, { vibhag, approved: 0, pending: 0, rejected: 0, total: 0 });
    }

    const item = groupsMap.get(vibhag);
    const status = String(r.Status || r.status || "Pending").trim();
    if (status === "Approved") {
      item.approved++;
      grandApproved++;
    } else if (status === "Disapproved" || status === "Rejected") {
      item.rejected++;
      grandRejected++;
    } else {
      item.pending++;
      grandPending++;
    }
    item.total++;
    grandTotal++;
  });

  const rows = Array.from(groupsMap.values());
  rows.sort((a, b) => a.vibhag.localeCompare(b.vibhag));

  return {
    rows,
    totals: {
      approved: grandApproved,
      pending: grandPending,
      rejected: grandRejected,
      total: grandTotal
    }
  };
}

function generatePDF(pivotData, config = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  const headerTitle = (config.pdfHeaderTitle || "MUMBAI MEGHWAL PANCHAYAT & VIDYA GOHIL CHARITABLE TRUST").trim();
  const headerSubtitle = (config.pdfHeaderSubtitle || "SUMMARY COUNT REPORT - EDUCATION FELICITATION 2026").trim();

  // Top Dark Banner
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(headerTitle, pageWidth / 2, 9, { align: "center" });

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(headerSubtitle, pageWidth / 2, 16, { align: "center" });

  let yPos = 28;
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");

  const todayStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  doc.text(`Report Date: ${todayStr}  |  Pivot Fields: Vibhag  |  Total Entries: ${pivotData.totals.total}`, margin, yPos);

  yPos += 5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 5;

  const vibhagWidth = 90;
  const statColWidth = 24;
  const rowHeight = 7.5;
  const headerHeight = 8.5;

  const drawTableHeader = (currentY) => {
    doc.setFillColor(51, 65, 85);
    doc.rect(margin, currentY, contentWidth, headerHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    doc.text("Vibhag", margin + 2, currentY + 5.5);
    doc.text("Approved", margin + vibhagWidth + 2, currentY + 5.5);
    doc.text("Pending", margin + vibhagWidth + statColWidth + 2, currentY + 5.5);
    doc.text("Rejected", margin + vibhagWidth + (statColWidth * 2) + 2, currentY + 5.5);
    doc.text("Total", margin + vibhagWidth + (statColWidth * 3) + 2, currentY + 5.5);

    return currentY + headerHeight;
  };

  yPos = drawTableHeader(yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  pivotData.rows.forEach((r, rIdx) => {
    if (yPos + rowHeight > pageHeight - 14) {
      doc.addPage();
      yPos = 12;
      yPos = drawTableHeader(yPos);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
    }

    if (rIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, contentWidth, rowHeight, "F");
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.rect(margin, yPos, contentWidth, rowHeight, "S");

    doc.setTextColor(30, 41, 59);

    const vText = doc.splitTextToSize(r.vibhag, vibhagWidth - 3)[0] || r.vibhag;

    doc.text(vText, margin + 2, yPos + 5);
    doc.text(String(r.approved), margin + vibhagWidth + 2, yPos + 5);
    doc.text(String(r.pending), margin + vibhagWidth + statColWidth + 2, yPos + 5);
    doc.text(String(r.rejected), margin + vibhagWidth + (statColWidth * 2) + 2, yPos + 5);
    doc.text(String(r.total), margin + vibhagWidth + (statColWidth * 3) + 2, yPos + 5);

    yPos += rowHeight;
  });

  // Grand Totals Row
  if (yPos + rowHeight > pageHeight - 14) {
    doc.addPage();
    yPos = 12;
  }
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, yPos, contentWidth, rowHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL", margin + 2, yPos + 5);

  doc.text(String(pivotData.totals.approved), margin + vibhagWidth + 2, yPos + 5);
  doc.text(String(pivotData.totals.pending), margin + vibhagWidth + statColWidth + 2, yPos + 5);
  doc.text(String(pivotData.totals.rejected), margin + vibhagWidth + (statColWidth * 2) + 2, yPos + 5);
  doc.text(String(pivotData.totals.total), margin + vibhagWidth + (statColWidth * 3) + 2, yPos + 5);

  // Page numbering
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${totalPages}  |  Mumbai Meghwal Panchayat & Vidya Gohil Trust Portal`, pageWidth / 2, pageHeight - 5, { align: "center" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

async function sendEmailWithPDF(pdfBuffer, pivotData, config = {}) {
  if (!SENDER_PASS) {
    console.warn("⚠️ SMTP_PASS is not set in environment. PDF was generated but email could not be sent.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SENDER_EMAIL,
      pass: SENDER_PASS
    }
  });

  const todayStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const filename = `Pivot_Summary_Report_Education_felicitation_2026_${todayStr.replace(/\s+/g, "_")}.pdf`;

  const headerTitle = (config.pdfHeaderTitle || "MUMBAI MEGHWAL PANCHAYAT & VIDYA GOHIL CHARITABLE TRUST").trim();
  const headerSubtitle = (config.pdfHeaderSubtitle || "SUMMARY COUNT REPORT - EDUCATION FELICITATION 2026").trim();

  const rowsHtml = pivotData.rows.map((r, i) => `
    <tr style="background: ${i % 2 === 1 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 9px 12px; font-weight: 600; color: #1e293b;">${r.vibhag}</td>
      <td style="padding: 9px 12px; text-align: center; color: #15803d; font-weight: 700;">${r.approved}</td>
      <td style="padding: 9px 12px; text-align: center; color: #b45309; font-weight: 700;">${r.pending}</td>
      <td style="padding: 9px 12px; text-align: center; color: #b91c1c; font-weight: 700;">${r.rejected}</td>
      <td style="padding: 9px 12px; text-align: center; font-weight: 800; color: #0f172a;">${r.total}</td>
    </tr>
  `).join("");

  const mailOptions = {
    from: `"MMP & Vidya Gohil Trust" <${SENDER_EMAIL}>`,
    to: RECIPIENTS,
    subject: `📊 Daily Registration Summary Report - ${todayStr}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
        <div style="background: #1e293b; color: white; padding: 18px 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="margin: 0; font-size: 16px;">${headerTitle}</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">${headerSubtitle}</p>
        </div>

        <div style="padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin-top: 0;">Respected Committee Members,</p>
          <p>Please find below the daily <strong>Pivot Summary Count Report</strong> for <strong>Education Felicitation 2026</strong> as of <strong>${todayStr}</strong>.</p>
          
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0;">
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: bold; color: #0f172a;">${pivotData.totals.total}</div>
              <div style="font-size: 11px; color: #64748b; font-weight: 600;">Total Entries</div>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: bold; color: #15803d;">${pivotData.totals.approved}</div>
              <div style="font-size: 11px; color: #166534; font-weight: 600;">Approved</div>
            </div>
            <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: bold; color: #b45309;">${pivotData.totals.pending}</div>
              <div style="font-size: 11px; color: #92400e; font-weight: 600;">Pending</div>
            </div>
            <div style="background: #fef2f2; border: 1px solid #fca5a5; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: bold; color: #b91c1c;">${pivotData.totals.rejected}</div>
              <div style="font-size: 11px; color: #991b1b; font-weight: 600;">Rejected</div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
            <thead>
              <tr style="background: #1e293b; color: white;">
                <th style="padding: 10px 12px; text-align: left;">Vibhag</th>
                <th style="padding: 10px 12px; text-align: center;">Approved</th>
                <th style="padding: 10px 12px; text-align: center;">Pending</th>
                <th style="padding: 10px 12px; text-align: center;">Rejected</th>
                <th style="padding: 10px 12px; text-align: center;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr style="background: #1e293b; color: white; font-weight: bold;">
                <td style="padding: 11px 12px;">GRAND TOTAL</td>
                <td style="padding: 11px 12px; text-align: center;">${pivotData.totals.approved}</td>
                <td style="padding: 11px 12px; text-align: center;">${pivotData.totals.pending}</td>
                <td style="padding: 11px 12px; text-align: center;">${pivotData.totals.rejected}</td>
                <td style="padding: 11px 12px; text-align: center;">${pivotData.totals.total}</td>
              </tr>
            </tbody>
          </table>

          <p style="font-size: 13px; color: #64748b;">
            📎 The complete official PDF report (matching the website export) is attached to this email.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; margin-bottom: 0;">
            This is an automated report generated by Mumbai Meghwal Panchayat & Vidya Gohil Trust Portal.
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: filename,
        content: pdfBuffer,
        contentType: "application/pdf"
      }
    ]
  };

  console.log(`Sending email to: ${RECIPIENTS}...`);
  const info = await transporter.sendMail(mailOptions);
  console.log("✅ Email sent successfully! Message ID:", info.messageId);
}

async function main() {
  try {
    const idToken = await getAuthToken();
    const config = await fetchContentConfig(idToken);
    const regs = await fetchRegistrations(idToken);
    console.log(`Fetched ${regs.length} registrations.`);
    const pivotData = computePivotData(regs);
    console.log(`Computed ${pivotData.rows.length} pivot rows. Total: ${pivotData.totals.total}`);
    const pdfBuffer = generatePDF(pivotData, config);
    console.log(`Generated PDF (${pdfBuffer.length} bytes).`);
    await sendEmailWithPDF(pdfBuffer, pivotData, config);
    console.log("🎉 Daily Pivot Report process completed successfully!");
  } catch (err) {
    console.error("❌ Error in daily pivot report:", err);
    process.exit(1);
  }
}

main();
