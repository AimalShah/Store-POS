import { Router } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const router = Router();

const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
let cached = null;

function getPackageInfo() {
  if (!cached) {
    cached = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  }
  return cached;
}

router.get('/', (_req, res) => {
  const pkg = getPackageInfo();
  res.json({ version: pkg.version, name: pkg.name });
});

export default router;
