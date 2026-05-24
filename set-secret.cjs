const fs = require('fs');
const { execSync } = require('child_process');
const data = JSON.parse(fs.readFileSync('c:\\\\Users\\\\USER\\\\Downloads\\\\voltaic-signal-497217-q6-a4e6407621f2.json', 'utf8'));
fs.writeFileSync('.env.secret.tmp', `GOOGLE_PRIVATE_KEY="${data.private_key.replace(/\n/g, '\\n')}"\n`);
execSync('npx.cmd supabase secrets set --env-file .env.secret.tmp', { stdio: 'inherit' });
fs.unlinkSync('.env.secret.tmp');
fs.unlinkSync('set-secret.js');
console.log('Secret set successfully!');
