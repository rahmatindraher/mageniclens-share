import { mkdir, copyFile, writeFile } from 'node:fs/promises';

const fields = {
  apiKey: 'FIREBASE_API_KEY',
  authDomain: 'FIREBASE_AUTH_DOMAIN',
  projectId: 'FIREBASE_PROJECT_ID',
  appId: 'FIREBASE_APP_ID'
};

const config = {};
for (const [field, variable] of Object.entries(fields)) {
  const value = process.env[variable]?.trim();
  if (!value || value.startsWith('PASTE_')) {
    throw new Error(`Isi ${variable} di Vercel dengan nilai ${field} dari Firebase Web App.`);
  }
  config[field] = value;
}

await mkdir('dist', { recursive: true });
await writeFile('dist/firebase-config.js', 'window.MGL_FIREBASE_CONFIG = ' + JSON.stringify(config) + ';\n');
await copyFile('index.html', 'dist/index.html');
