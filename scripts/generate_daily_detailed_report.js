import { jsPDF } from "jspdf";
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";

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
    console.log(`Authenticating with custom Firebase Auth credentials...`);
    const token = await authenticate(customEmail, customPassword);
    if (token) {
      console.log("✅ Authenticated successfully with custom credentials!");
      return token;
    }
    console.warn("⚠️ Custom credentials failed. Falling back to built-in report runner...");
  }

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

function prepareDetailedTableData(registrations) {
  const active = registrations.filter(r => !r.deleted && !r.isGlobalGuest && !r.isSpecialGuest);

  // Sort by date or sequential number
  active.sort((a, b) => {
    const timeA = new Date(a._submittedAt || a.Date || 0).getTime();
    const timeB = new Date(b._submittedAt || b.Date || 0).getTime();
    return timeA - timeB;
  });

  // Discover all custom keys
  const standardKeys = [
    "Transaction ID",
    "Date",
    "Event",
    "Status",
    "Full Name",
    "Mobile Number",
    "Vibhag",
    "Stream",
    "Obtained Marks",
    "Out Of Marks",
    "% Obtained",
    "Remarks",
    "Updated By"
  ];

  const ignoreKeys = new Set([
    "id", "eventId", "eventTitle", "eventName", "_submittedAt", "logHistory",
    "Status", "status", "Remarks", "remarks", "Updated By", "updatedBy", "transactionId",
    "Transaction ID", "Full Name", "Mobile Number", "Vibhag", "Stream", "Obtained Marks", "Out Of Marks", "% Obtained"
  ]);

  const customKeys = [];
  active.forEach(r => {
    Object.keys(r).forEach(k => {
      if (!k.startsWith("_") && !ignoreKeys.has(k) && !standardKeys.includes(k) && !customKeys.includes(k)) {
        customKeys.push(k);
      }
    });
  });

  const allColumns = [...standardKeys, ...customKeys];

  const rows = active.map((r, idx) => {
    const rawName = String(r["Full Name"] || r["Submitted By"] || r["Participant Name"] || r.name || "-");
    const cleanName = rawName.replace(/\|/g, " ").replace(/\s+/g, " ").trim();

    let dateStr = "-";
    if (r._submittedAt) {
      dateStr = new Date(r._submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } else if (r.Date) {
      dateStr = String(r.Date);
    }

    const rowObj = {
      "#": idx + 1,
      "Transaction ID": r["Transaction ID"] || r.transactionId || r.id || "-",
      "Date": dateStr,
      "Event": r.eventName || r.eventTitle || "Education Felicitation 2026",
      "Status": r.Status || r.status || "Pending",
      "Full Name": cleanName,
      "Mobile Number": r["Mobile Number"] || r.submitterMob || r.mobile || "-",
      "Vibhag": r["Vibhag"] || r["vibhag"] || r["MMP Vibhag"] || "-",
      "Stream": r["Stream"] || r["stream"] || r["Class"] || "-",
      "Obtained Marks": r["Obtained Marks"] || "-",
      "Out Of Marks": r["Out Of Marks"] || "-",
      "% Obtained": (r["% Obtained"] || r["%"]) ? `${r["% Obtained"] || r["%"]}%` : "-",
      "Remarks": r.Remarks || r.remarks || "-",
      "Updated By": r["Updated By"] || r.updatedBy || "-"
    };

    customKeys.forEach(ck => {
      rowObj[ck] = r[ck] !== undefined && r[ck] !== null ? String(r[ck]) : "-";
    });

    return rowObj;
  });

  let approved = 0, pending = 0, rejected = 0;
  active.forEach(r => {
    const s = String(r.Status || r.status || "Pending").trim();
    if (s === "Approved") approved++;
    else if (s === "Disapproved" || s === "Rejected") rejected++;
    else pending++;
  });

  return {
    columns: allColumns,
    rows,
    totals: {
      total: active.length,
      approved,
      pending,
      rejected
    }
  };
}

function generateExcelBuffer(tableData) {
  const ws = XLSX.utils.json_to_sheet(tableData.rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Detailed Registrations");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function generatePDFBuffer(tableData, config = {}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  const headerTitle = (config.pdfHeaderTitle || "MUMBAI MEGHWAL PANCHAYAT & VIDYA GOHIL CHARITABLE TRUST").trim();
  const headerSubtitle = "DETAILED REGISTRATIONS REPORT — EDUCATION FELICITATION 2026";

  // Top Dark Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 20, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(headerTitle, pageWidth / 2, 8, { align: "center" });

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(headerSubtitle, pageWidth / 2, 15, { align: "center" });

  let yPos = 26;
  const todayStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text(`Report Date: ${todayStr}  |  Total Active Entries: ${tableData.totals.total}  (Approved: ${tableData.totals.approved}, Pending: ${tableData.totals.pending}, Rejected: ${tableData.totals.rejected})`, margin, yPos);

  yPos += 5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 4;

  const cols = [
    { label: "#", w: 10 },
    { label: "Txn ID", w: 22 },
    { label: "Date", w: 22 },
    { label: "Student Name", w: 55 },
    { label: "Mobile", w: 28 },
    { label: "Vibhag", w: 42 },
    { label: "Stream / Class", w: 42 },
    { label: "%", w: 18 },
    { label: "Status", w: 25 },
    { label: "Remarks", w: 13 }
  ];

  const rowHeight = 6.5;
  const headerHeight = 7.5;

  const drawTableHeader = (currY) => {
    doc.setFillColor(51, 65, 85);
    doc.rect(margin, currY, contentWidth, headerHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let x = margin;
    cols.forEach(c => {
      doc.text(c.label, x + 2, currY + 5);
      x += c.w;
    });

    return currY + headerHeight;
  };

  yPos = drawTableHeader(yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  tableData.rows.forEach((r, rIdx) => {
    if (yPos + rowHeight > pageHeight - 12) {
      doc.addPage();
      yPos = 12;
      yPos = drawTableHeader(yPos);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
    }

    if (rIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, contentWidth, rowHeight, "F");
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.rect(margin, yPos, contentWidth, rowHeight, "S");

    doc.setTextColor(30, 41, 59);

    let x = margin;
    const values = [
      String(r["#"]),
      String(r["Transaction ID"]),
      String(r["Date"]),
      doc.splitTextToSize(String(r["Full Name"]), 52)[0] || r["Full Name"],
      String(r["Mobile Number"]),
      doc.splitTextToSize(String(r["Vibhag"]), 40)[0] || r["Vibhag"],
      doc.splitTextToSize(String(r["Stream"]), 40)[0] || r["Stream"],
      String(r["% Obtained"]),
      String(r["Status"]),
      doc.splitTextToSize(String(r["Remarks"]), 12)[0] || r["Remarks"]
    ];

    cols.forEach((c, cIdx) => {
      if (cIdx === 8) { // Status color
        if (r["Status"] === "Approved") doc.setTextColor(22, 101, 52);
        else if (r["Status"] === "Rejected" || r["Status"] === "Disapproved") doc.setTextColor(153, 27, 27);
        else doc.setTextColor(180, 83, 9);
      } else {
        doc.setTextColor(30, 41, 59);
      }

      doc.text(String(values[cIdx]), x + 2, yPos + 4.5);
      x += c.w;
    });

    yPos += rowHeight;
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${totalPages}  |  Mumbai Meghwal Panchayat Official Database`, pageWidth / 2, pageHeight - 4, { align: "center" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

async function sendDetailedEmailReport(excelBuffer, pdfBuffer, tableData, config = {}) {
  if (!SENDER_PASS) {
    console.warn("⚠️ SMTP_PASS is not set in environment. Attachments generated but email could not be sent.");
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
  const baseFilename = `Detailed_Registrations_Education_Felicitation_2026_${todayStr.replace(/\s+/g, "_")}`;

  const headerTitle = (config.pdfHeaderTitle || "MUMBAI MEGHWAL PANCHAYAT & VIDYA GOHIL CHARITABLE TRUST").trim();

  // HTML Table Rows for Email (First 50 entries with clean layout)
  const rowsHtml = tableData.rows.slice(0, 100).map((r, i) => `
    <tr style="background: ${i % 2 === 1 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0; font-size: 12px;">
      <td style="padding: 7px 9px; text-align: center; color: #64748b;">${r["#"]}</td>
      <td style="padding: 7px 9px; font-weight: 700; font-family: monospace; color: #1e293b;">${r["Transaction ID"]}</td>
      <td style="padding: 7px 9px; color: #475569; white-space: nowrap;">${r["Date"]}</td>
      <td style="padding: 7px 9px; font-weight: 700; color: #0f172a;">${r["Full Name"]}</td>
      <td style="padding: 7px 9px; color: #334155;">${r["Mobile Number"]}</td>
      <td style="padding: 7px 9px; color: #334155;">${r["Vibhag"]}</td>
      <td style="padding: 7px 9px; color: #334155;">${r["Stream"]}</td>
      <td style="padding: 7px 9px; font-weight: 700; color: #0f172a;">${r["% Obtained"]}</td>
      <td style="padding: 7px 9px; text-align: center;">
        <span style="background: ${r["Status"] === "Approved" ? "#dcfce7" : r["Status"] === "Rejected" ? "#fee2e2" : "#fef3c7"}; color: ${r["Status"] === "Approved" ? "#166534" : r["Status"] === "Rejected" ? "#991b1b" : "#92400e"}; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 11px;">
          ${r["Status"]}
        </span>
      </td>
    </tr>
  `).join("");

  const mailOptions = {
    from: `"MMP & Vidya Gohil Trust" <${SENDER_EMAIL}>`,
    to: RECIPIENTS,
    subject: `📋 Daily Detailed Records Table - Education Felicitation 2026 (${todayStr})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
        <div style="background: #1e293b; color: white; padding: 18px 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="margin: 0; font-size: 16px;">${headerTitle}</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">DAILY DETAILED RECORD REPORT — ALL COLUMNS</p>
        </div>

        <div style="padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin-top: 0;">Respected Committee Members & Leadership,</p>
          <p>Please find below the automated <strong>Daily Detailed Record Table (All Columns)</strong> for <strong>Education Felicitation 2026</strong> as of <strong>${todayStr}</strong>.</p>
          
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0;">
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: bold; color: #0f172a;">${tableData.totals.total}</div>
              <div style="font-size: 11px; color: #64748b; font-weight: 600;">Total Registrations</div>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: bold; color: #15803d;">${tableData.totals.approved}</div>
              <div style="font-size: 11px; color: #166534; font-weight: 600;">Approved</div>
            </div>
            <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: bold; color: #b45309;">${tableData.totals.pending}</div>
              <div style="font-size: 11px; color: #92400e; font-weight: 600;">Pending</div>
            </div>
            <div style="background: #fef2f2; border: 1px solid #fca5a5; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: bold; color: #b91c1c;">${tableData.totals.rejected}</div>
              <div style="font-size: 11px; color: #991b1b; font-weight: 600;">Rejected</div>
            </div>
          </div>

          <div style="overflow-x: auto; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #1e293b; color: white;">
                  <th style="padding: 8px; text-align: center;">#</th>
                  <th style="padding: 8px; text-align: left;">Txn ID</th>
                  <th style="padding: 8px; text-align: left;">Date</th>
                  <th style="padding: 8px; text-align: left;">Student Name</th>
                  <th style="padding: 8px; text-align: left;">Mobile</th>
                  <th style="padding: 8px; text-align: left;">Vibhag</th>
                  <th style="padding: 8px; text-align: left;">Stream</th>
                  <th style="padding: 8px; text-align: left;">%</th>
                  <th style="padding: 8px; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 12px 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #166534; font-weight: 600;">
              📎 <strong>Attachments Included:</strong>
            </p>
            <ul style="margin: 6px 0 0 0; padding-left: 20px; font-size: 12px; color: #15803d;">
              <li><strong>${baseFilename}.xlsx</strong> — Full editable Microsoft Excel database with all custom columns.</li>
              <li><strong>${baseFilename}.pdf</strong> — Official Landscape PDF report document.</li>
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; margin-bottom: 0;">
            This is an automated report generated by Mumbai Meghwal Panchayat & Vidya Gohil Trust Portal.
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `${baseFilename}.xlsx`,
        content: excelBuffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      },
      {
        filename: `${baseFilename}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf"
      }
    ]
  };

  console.log(`Sending Detailed Record Email to: ${RECIPIENTS}...`);
  const info = await transporter.sendMail(mailOptions);
  console.log("✅ Detailed Record Email sent successfully! Message ID:", info.messageId);
}

async function main() {
  try {
    const idToken = await getAuthToken();
    const config = await fetchContentConfig(idToken);
    const regs = await fetchRegistrations(idToken);
    console.log(`Fetched ${regs.length} registrations from Firestore.`);

    const tableData = prepareDetailedTableData(regs);
    console.log(`Prepared ${tableData.rows.length} detailed rows with ${tableData.columns.length} columns.`);

    const excelBuffer = generateExcelBuffer(tableData);
    console.log(`Generated Excel (.xlsx) spreadsheet (${excelBuffer.length} bytes).`);

    const pdfBuffer = generatePDFBuffer(tableData, config);
    console.log(`Generated PDF document (${pdfBuffer.length} bytes).`);

    await sendDetailedEmailReport(excelBuffer, pdfBuffer, tableData, config);
    console.log("🎉 Daily Detailed Record Report process completed successfully!");
  } catch (err) {
    console.error("❌ Error in daily detailed record report:", err);
    process.exit(1);
  }
}

main();
