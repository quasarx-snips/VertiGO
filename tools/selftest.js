import { runSelfTest } from './measures.js';

const rows = runSelfTest(0);
for (const row of rows) {
  process.stdout.write((row.ok ? 'pass ' : 'FAIL ') + row.label + '  ' + row.actual + '\n');
}
process.exit(rows.every((row) => row.ok) ? 0 : 1);
