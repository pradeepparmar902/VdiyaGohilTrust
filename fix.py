import codecs

lines = []
with codecs.open('C:/Users/Pradeep.Parmar/OneDrive - insidemedia.net/personal/My Website/community/trust-frontend/src/CharitableTrust.jsx', 'r', 'utf-8') as f:
    lines = f.readlines()

new_lines = lines[:7588]
new_lines.append('          {saving ? "Saving Changes..." : "?? Save & Publish SEO Settings"}\n')
new_lines.append('        </button>\n')
new_lines.append('      </div>\n')
new_lines.append('    </div>\n')
new_lines.append('  );\n')
new_lines.append('}\n')
new_lines.append('\n')
new_lines.append('// ——— ADMIN DASHBOARD —————————————————————————————————————————————————————————————————————\n')
new_lines.append('const ANAV = [\n')
new_lines.append('  {id:"content",icon:"??",label:"Content Editor"},\n')
new_lines.append('  {id:"seo",icon:"??",label:"SEO Settings"},\n')
new_lines.append('  {id:"overview",icon:"??",label:"Overview"},\n')
new_lines.append('  {id:"donations",icon:"??",label:"Donations"},\n')
new_lines.append('  {id:"events",icon:"??",label:"Events"},\n')
new_lines.append('  {id:"registrations",icon:"??",label:"Registrations"},\n')
new_lines.append('  {id:"volunteers",icon:"??",label:"Volunteers"},\n')
new_lines.append('  {id:"gallery",icon:"???",label:"Gallery"},\n')
new_lines.append('  {id:"team",icon:"??",label:"Our Team"},\n')
new_lines.append('  {id:"medialibrary",icon:"??",label:"Media Library"},\n')
new_lines.append('  {id:"achievements",icon:"??",label:"Achievements"},\n')
new_lines.append('  {id:"settings",icon:"??",label:"Settings"},\n')
new_lines.append('  {id:"chatbotaccess",icon:"??",label:"Chatbot Admins"},\n')
new_lines.append('  {id:"whatsappadmin",icon:"??",label:"WhatsApp Admin"},\n')
new_lines.append('  {id:"access",icon:"??",label:"Access Control"},\n')
new_lines.append('  {id:"masterdata",icon:"???",label:"Master Data"},\n')
new_lines.append('  {id:"backup",icon:"??",label:"Backup & Restore"},\n')
new_lines.append('  {id:"profile",icon:"??",label:"My Profile"},\n')
new_lines.append('  {id:"meritlist",label:"Reports & Lists",icon:"??"},\n')
new_lines.append('  {id:"inviteletters",label:"Letters, Invites & Passes",icon:"??"}\n')
new_lines.append('];\n')

# extend with everything from 7622 onwards
new_lines.extend(lines[7621:])

with codecs.open('C:/Users/Pradeep.Parmar/OneDrive - insidemedia.net/personal/My Website/community/trust-frontend/src/CharitableTrust.jsx', 'w', 'utf-8') as f:
    f.writelines(new_lines)
