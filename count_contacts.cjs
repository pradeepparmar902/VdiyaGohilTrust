const fs = require('fs');
const https = require('https');

const projectId = 'mmp-cwc-new';
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/registrations`;

function fetchREST(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log('Fetching all registrations...');
  let existing = [];
  let pageToken = '';
  do {
    const url = `${baseUrl}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetchREST(url, { method: 'GET' });
    if (res.documents) {
      existing = existing.concat(res.documents);
    }
    pageToken = res.nextPageToken || null;
  } while (pageToken);

  console.log('Total documents:', existing.length);
  const contacts = existing.filter(doc => {
    try {
      const data = JSON.parse(doc.fields.data.stringValue);
      return data.isGlobalGuest === true || data.formId === 'global_guest_directory' || data.formId === 'global_guest_directory_import';
    } catch(e) { return false; }
  });

  console.log('Contacts to migrate:', contacts.length);
}
run();
