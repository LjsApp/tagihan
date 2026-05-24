const fs = require('fs');
const https = require('https');

const keyData = JSON.parse(fs.readFileSync('c:\\\\Users\\\\USER\\\\Downloads\\\\voltaic-signal-497217-q6-a4e6407621f2.json', 'utf8'));

async function getAccessToken() {
  const crypto = require('crypto');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: keyData.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  })).toString('base64url');
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(keyData.private_key, 'base64url');
  const jwt = `${header}.${payload}.${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data).access_token));
    });
    req.write(`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`);
    req.end();
  });
}

async function testDrive() {
  try {
    const token = await getAccessToken();
    console.log("Token obtained successfully.");
    
    // Check if the service account can see the specific folder
    const folderId = "1FWcXF0WFKSKOSosmP6KDfwpj_tl1Oq_k";
    
    const req = https.request(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        console.log(`Status for folder ${folderId}:`, res.statusCode);
        console.log(`Response:`, data);
      });
    });
    req.end();

    // List everything it can see
    const listReq = https.request(`https://www.googleapis.com/drive/v3/files?q=trashed=false&fields=files(id,name,mimeType)&pageSize=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        console.log(`\nFiles visible to Service Account:`);
        console.log(data);
      });
    });
    listReq.end();
  } catch(e) {
    console.error("Test failed", e);
  }
}

testDrive();
