import fs from "fs";
const code = fs.readFileSync("src/CharitableTrust.jsx", "utf8");
const lines = code.split("\n");
lines.forEach((l, idx) => {
  if (l.includes("generateCertificatePDF") && (l.includes("function") || l.includes("const ") || l.includes("let "))) {
    console.log((idx + 1) + ": " + l.trim());
  }
});
