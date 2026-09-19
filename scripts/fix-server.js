const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../.next/standalone/server.js');

if (!fs.existsSync(serverPath)) {
  console.error('server.js not found in .next/standalone/');
  process.exit(1);
}

const serverContent = fs.readFileSync(serverPath, 'utf8');

// Check if the .env loading code is already present
if (!serverContent.includes('Load .env file from standalone directory') &&
    !serverContent.includes('Load .env from standalone directory')) {
  const insertionPoint = "process.env.NODE_ENV = 'production'";
  const envLoader = `const fs = require('fs')

// Load .env from standalone directory, falling back to project root
const standaloneEnv = path.join(__dirname, '.env')
const envPath = fs.existsSync(standaloneEnv)
  ? standaloneEnv
  : path.join(__dirname, '../../.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].replace(/^["']|["']$/g, '').replace(/\\\\n/g, '\\n')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

${insertionPoint}`;

  const updatedContent = serverContent.replace(insertionPoint, envLoader);
  fs.writeFileSync(serverPath, updatedContent);
  console.log('✓ server.js updated with .env loading');
} else {
  console.log('✓ server.js already has .env loading');
}
