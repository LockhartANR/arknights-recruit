import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const operatorsPath = path.join(__dirname, '..', '..', 'client', 'public', 'operators.json');

let operators = [];
try {
  operators = JSON.parse(fs.readFileSync(operatorsPath, 'utf-8'));
} catch {
  console.warn('operators.json not found at', operatorsPath);
}

const router = Router();

router.get('/', (req, res) => {
  res.json(operators);
});

export default router;
