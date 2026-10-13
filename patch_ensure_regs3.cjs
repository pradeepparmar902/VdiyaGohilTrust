const fs = require('fs');
const file = 'C:/Users/Pradeep.Parmar/OneDrive - insidemedia.net/personal/My Website/community/trust-frontend/src/CharitableTrust.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = /if \(\(r\.isGlobalGuest === true\)? \|\| \(r\.formId === "global_guest_directory" && !r\.eventId && !r\.eventName && !r\.targetTemplateId && \(!Array\.isArray\(r\.assignedDocTypes\) \|\| r\.assignedDocTypes\.length === 0\)\)\) return false;/g;
const replacement = 'if ((r.isGlobalGuest === true && !r.eventId && !r.eventName) || (r.formId === "global_guest_directory" && !r.eventId && !r.eventName && !r.targetTemplateId && (!Array.isArray(r.assignedDocTypes) || r.assignedDocTypes.length === 0))) return false;';

const target2 = /if \(r\.isGlobalGuest === true \|\| \(r\.formId === "global_guest_directory" && !r\.eventId && !r\.eventName && !r\.targetTemplateId && \(!Array\.isArray\(r\.assignedDocTypes\) \|\| r\.assignedDocTypes\.length === 0\)\)\) return false;/g;
const replacement2 = 'if ((r.isGlobalGuest === true && !r.eventId && !r.eventName) || (r.formId === "global_guest_directory" && !r.eventId && !r.eventName && !r.targetTemplateId && (!Array.isArray(r.assignedDocTypes) || r.assignedDocTypes.length === 0))) return false;';

if (content.match(target) || content.match(target2)) {
  content = content.replace(target, replacement);
  content = content.replace(target2, replacement2);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched all instances.');
} else {
  console.log('Target string not found.');
}
