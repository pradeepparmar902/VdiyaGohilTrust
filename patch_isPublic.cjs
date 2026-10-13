const fs = require('fs');
const file = 'c:/Users/Pradeep.Parmar/OneDrive - insidemedia.net/personal/My Website/community/trust-frontend/src/CharitableTrust.jsx';

let code = fs.readFileSync(file, 'utf8');

const target = 'if (ev && (ev.isInternalOnly || ev.hideFromPublicWebsite || ev.isInternal || ev.isWorkspaceOnly || ev.section === "Internal Admin" || ev.tag === "Internal Admin")) {\r\n      return false;\r\n    }';

const repl = 'if (ev && (ev.isInternalOnly || ev.hideFromPublicWebsite || ev.isInternal || ev.isWorkspaceOnly || ev.section === "Internal Admin" || ev.tag === "Internal Admin")) {\r\n      const evTitle = String(ev.title || "").toLowerCase();\r\n      if (!(evTitle.includes("education") || evTitle.includes("felicitation"))) return false;\r\n    }';

if (code.includes(target)) {
    fs.writeFileSync(file, code.replace(target, repl), 'utf8');
    console.log('Patched successfully.');
} else {
    const target2 = target.replace(/\r\n/g, '\n');
    const repl2 = repl.replace(/\r\n/g, '\n');
    if (code.includes(target2)) {
        fs.writeFileSync(file, code.replace(target2, repl2), 'utf8');
        console.log('Patched successfully (Unix line endings).');
    } else {
        console.log('Target string still not found. Please review the target string.');
    }
}
