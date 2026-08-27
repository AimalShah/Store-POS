import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const onWindows = process.platform === 'win32';

const runtime = process.argv[2];
const supported = ['node', 'electron'];
if (!supported.includes(runtime)) {
  console.error(`usage: node scripts/use-native.mjs <${supported.join('|')}>`);
  process.exit(1);
}

let electronTarget = '';
if (runtime === 'electron') {
  const electronPkg = path.join(root, 'node_modules', 'electron', 'package.json');
  if (!existsSync(electronPkg)) {
    console.error('[native] electron is not installed; run npm ci first.');
    process.exit(1);
  }
  electronTarget = JSON.parse(readFileSync(electronPkg, 'utf8')).version;
}

function rebuildModule(name, { optional = false, binSubpath = null, smokeTest = null } = {}) {
  const pkgDir = path.join(root, 'node_modules', name);
  if (!existsSync(pkgDir)) {
    if (optional) {
      console.warn(`[native] ${name} is not installed; skipping (USB printing unavailable).`);
      return true;
    }
    console.error(`[native] ${name} is not installed; run npm ci first.`);
    process.exit(1);
  }

  const binPath = binSubpath
    ? path.join(pkgDir, ...binSubpath)
    : null;

  if (binPath && existsSync(binPath)) {
    rmSync(binPath, { force: true });
  }

  const args = ['--yes', 'prebuild-install', '--tag-prefix=v', `--runtime=${runtime}`];
  if (runtime === 'electron') args.push(`--target=${electronTarget}`);

  console.log(`[native] switching ${name} to ${runtime}${runtime === 'electron' ? ` ${electronTarget}` : ''}...`);
  let res = spawnSync('npx', args, { cwd: pkgDir, stdio: 'inherit', shell: onWindows });

  if (res.status !== 0) {
    console.log(`[native] no prebuilt binary available for ${name}; compiling from source...`);
    if (runtime === 'electron') {
      res = spawnSync('npx', ['--yes', '@electron/rebuild', '-f', '-w', name, '-v', electronTarget], {
        cwd: root,
        stdio: 'inherit',
        shell: onWindows,
      });
    } else {
      res = spawnSync('npm', ['rebuild', name], { cwd: root, stdio: 'inherit', shell: onWindows });
    }
  }

  if (res.status !== 0) {
    if (optional) {
      console.warn(`[native] failed to build ${name} for ${runtime}; USB printing on Windows will not work.`);
      return false;
    }
    console.error(`[native] failed to build ${name} for ${runtime}`);
    process.exit(1);
  }

  if (binPath && !existsSync(binPath)) {
    if (optional) {
      console.warn(`[native] build reported success for ${name} but no binary was produced; skipping.`);
      return false;
    }
    console.error(`[native] build reported success but no binary was produced at ${binPath}`);
    process.exit(1);
  }

  if (binPath) {
    const magic = readFileSync(binPath).subarray(0, 4);
    let headerOk = false;
    if (process.platform === 'win32') {
      headerOk = magic[0] === 0x4d && magic[1] === 0x5a;
    } else if (process.platform === 'linux') {
      headerOk = magic[0] === 0x7f && magic[1] === 0x45 && magic[2] === 0x4c && magic[3] === 0x46;
    } else if (process.platform === 'darwin') {
      headerOk = magic[2] === 0xcf || magic[1] === 0xcf || magic[0] === 0xcf || magic[0] === 0xca;
    }
    if (!headerOk) {
      const msg = `[native] binary at ${binPath} has a foreign platform header (${magic.toString('hex')}); expected ${process.platform}`;
      if (optional) {
        console.warn(`[native] ${msg}; skipping.`);
        return false;
      }
      console.error(msg);
      process.exit(1);
    }
  }

  if (smokeTest) {
    const check = spawnSync(process.execPath, ['-e', smokeTest], { cwd: root, stdio: 'pipe' });
    if (check.status !== 0) {
      const msg = `[native] ${name} binary failed to load under Node:\n${check.stderr.toString()}`;
      if (optional) {
        console.warn(`[native] ${msg}`);
        return false;
      }
      console.error(msg);
      process.exit(1);
    }
  }

  console.log(`[native] ${name} ready for ${runtime}`);
  return true;
}

rebuildModule('better-sqlite3', {
  binSubpath: ['build', 'Release', 'better_sqlite3.node'],
  smokeTest:
    "const D=require('better-sqlite3');const db=new D(':memory:');db.exec('create table t(x);insert into t values(1)');const r=db.prepare('select x from t').get();if(r.x!==1)process.exit(1);db.close();",
});

rebuildModule('@thiagoelg/node-printer', {
  optional: true,
});
