const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = __dirname;
const LOCAL_PRTS = path.join(ROOT, '..', 'prts-fetcher', 'output');
const REPO = 'LockhartANR/PRTS-fetcher';
const BRANCH = 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const ZIP_URL = `https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip`;

const DST_JSON = path.join(ROOT, 'client', 'public', 'operators.json');
const DST_AVATARS = path.join(ROOT, 'client', 'public', 'operators');
const TMP = os.tmpdir();

const useLocal = process.argv.includes('--local');

async function main() {
  let operators;

  if (useLocal) {
    // --- Local mode ---
    const srcJson = path.join(LOCAL_PRTS, 'operators.json');
    if (!fs.existsSync(srcJson)) {
      console.error('ERROR: operators.json not found at', srcJson);
      process.exit(1);
    }
    operators = JSON.parse(fs.readFileSync(srcJson, 'utf-8'));
    console.log(`Read ${operators.length} operators from local ${srcJson}`);
  } else {
    // --- GitHub mode ---
    console.log(`Fetching ${RAW_BASE}/output/operators.json ...`);
    const res = await fetch(`${RAW_BASE}/output/operators.json`);
    if (!res.ok) {
      console.error('ERROR: Failed to fetch operators.json, status', res.status);
      process.exit(1);
    }
    operators = await res.json();
    console.log(`Fetched ${operators.length} operators`);
  }

  // Transform avatar to local path
  for (const op of operators) {
    op.avatar = `/operators/${op.id}.png`;
  }
  console.log('Transformed avatar fields to local paths');

  // Write operators.json
  fs.writeFileSync(DST_JSON, JSON.stringify(operators, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${operators.length} operators to ${DST_JSON}`);

  // Ensure destination avatar directory
  fs.mkdirSync(DST_AVATARS, { recursive: true });

  // Copy avatars
  if (useLocal) {
    const srcAvatars = path.join(LOCAL_PRTS, 'avatars');
    if (!fs.existsSync(srcAvatars)) {
      console.warn('WARNING: local avatars not found at', srcAvatars, '- skipping');
    } else {
      const files = fs.readdirSync(srcAvatars).filter(f => f.endsWith('.png'));
      for (const file of files) {
        fs.copyFileSync(path.join(srcAvatars, file), path.join(DST_AVATARS, file));
      }
      console.log(`Copied ${files.length} avatars from local`);
    }
  } else {
    await downloadAndExtractAvatars();
  }

  console.log('Sync complete.');
}

async function downloadAndExtractAvatars() {
  const zipPath = path.join(TMP, 'prts-fetcher.zip');
  const extractDir = path.join(TMP, 'prts-fetcher-extract');

  console.log(`Downloading ${ZIP_URL} ...`);
  const zipRes = await fetch(ZIP_URL);
  if (!zipRes.ok) {
    console.error('ERROR: Failed to download zip, status', zipRes.status);
    process.exit(1);
  }
  const zipBuf = Buffer.from(await zipRes.arrayBuffer());
  fs.writeFileSync(zipPath, zipBuf);
  console.log(`Downloaded zip (${(zipBuf.length / 1024 / 1024).toFixed(1)} MB)`);

  // Extract
  fs.rmSync(extractDir, { recursive: true, force: true });
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'inherit' });
  }
  console.log('Extracted zip');

  const zipAvatars = path.join(extractDir, `PRTS-fetcher-${BRANCH}`, 'output', 'avatars');
  if (!fs.existsSync(zipAvatars)) {
    console.error('ERROR: avatars not found in extracted zip at', zipAvatars);
    process.exit(1);
  }
  const files = fs.readdirSync(zipAvatars).filter(f => f.endsWith('.png'));
  for (const file of files) {
    fs.copyFileSync(path.join(zipAvatars, file), path.join(DST_AVATARS, file));
  }
  console.log(`Copied ${files.length} avatars to ${DST_AVATARS}`);

  // Cleanup
  fs.rmSync(zipPath, { force: true });
  fs.rmSync(extractDir, { recursive: true, force: true });
}

main().catch(err => {
  console.error('ERROR:', err.message);
  if (err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    console.error('HINT: Run with:  node --use-system-ca sync-operators.js');
  }
  process.exit(1);
});
