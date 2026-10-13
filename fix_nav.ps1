$filePath = "C:\Users\Pradeep.Parmar\OneDrive - insidemedia.net\personal\My Website\community\trust-frontend\src\CharitableTrust.jsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

$garbageRegex = '(?s)          \{saving \? "Saving Changes\.\.\." : "dY''_ Save & Publish SEO Settings"\}\r?\n        </button>\r?\n      </div>\r?\n    </div>\r?\n  \);\r?\n\}\r?\n\r?\n\r?\n// [^\n]+\r?\nconst ANAV = \[\r?\n(?:.*?)\r?\n\];'

$goodAnav = @"
// ADMIN DASHBOARD
const ANAV = [
  {id:"content",icon:"??",label:"Content Editor"},
  {id:"seo",icon:"??",label:"SEO Settings"},
  {id:"overview",icon:"??",label:"Overview"},
  {id:"donations",icon:"??",label:"Donations"},
  {id:"events",icon:"??",label:"Events"},
  {id:"registrations",icon:"??",label:"Registrations"},
  {id:"volunteers",icon:"??",label:"Volunteers"},
  {id:"gallery",icon:"???",label:"Gallery"},
  {id:"team",icon:"??",label:"Our Team"},
  {id:"medialibrary",icon:"??",label:"Media Library"},
  {id:"achievements",icon:"??",label:"Achievements"},
  {id:"settings",icon:"??",label:"Settings"},
  {id:"chatbotaccess",icon:"??",label:"Chatbot Admins"},
  {id:"whatsappadmin",icon:"??",label:"WhatsApp Admin"},
  {id:"access",icon:"??",label:"Access Control"},
  {id:"masterdata",icon:"???",label:"Master Data"},
  {id:"backup",icon:"??",label:"Backup & Restore"},
  {id:"profile",icon:"??",label:"My Profile"},
  {id:"meritlist",label:"Reports & Lists",icon:"??"},
  {id:"inviteletters",label:"Letters, Invites & Passes",icon:"??"}
];
"@

$newContent = $content -replace $garbageRegex, $goodAnav
[IO.File]::WriteAllText($filePath, $newContent, [System.Text.Encoding]::UTF8)
