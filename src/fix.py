import re

file_path = r'c:\Users\Pradeep.Parmar\OneDrive - insidemedia.net\personal\My Website\community\trust-frontend\src\CharitableTrust.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: dropdown
content = re.sub(
    r'(<option value="event">.*?</option>)',
    r'\1\n                          <option value="approved">✅ Approved / Verified Students</option>',
    content
)

# Fix 2: inviteRegs logic
old_logic = r'''    if \(activeDocId !== "invite" && activeDocId !== "cert"\) \{\s*// Direct streaming: When an event is selected in the Subworkspace Card, its registrations stream immediately\s*if \(matchesTargetEvent\) return true;\s*const targetAudienceMode = activeTplObj\?\.targetAudience \|\| "assigned"; // "assigned" \| "event" \| "group" \| "all"\s*if \(targetAudienceMode === "all" \|\| targetAudienceMode === "event"\) return true;'''

new_logic = '''    if (activeDocId !== "invite" && activeDocId !== "cert") {
      const targetAudienceMode = activeTplObj?.targetAudience || "assigned"; // "assigned" | "event" | "group" | "all" | "approved"

      if (targetAudienceMode === "approved") {
        return (r.Status === "Approved" || r.status === "Approved");
      }

      // Direct streaming: When an event is selected in the Subworkspace Card, its registrations stream immediately
      if (matchesTargetEvent) return true;

      if (targetAudienceMode === "all" || targetAudienceMode === "event") return true;'''

content = re.sub(old_logic, new_logic, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
