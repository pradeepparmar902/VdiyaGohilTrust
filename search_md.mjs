import fs from 'fs';
const code = fs.readFileSync('c:/Users/Pradeep.Parmar/OneDrive - insidemedia.net/personal/My Website/community/trust-frontend/src/CharitableTrust.jsx', 'utf8');
const lines = code.split('\n');
lines.forEach((l,i) => {
    if(l.includes('activeTab === "masterdata"') || l.includes('MasterData')) {
        console.log(i+1, l.trim().substring(0, 100));
    }
});
