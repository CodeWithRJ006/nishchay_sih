import fs from 'node:fs';
import path from 'node:path';
import { INSTRUMENT_RULES } from '../../shared/src/rules.js';

const docPath = path.join(process.cwd(), 'docs', 'RULES_TO_VERIFY.md');

const unverified = INSTRUMENT_RULES.filter(r => !r.verified);

let content = '# Rules to Verify\n\n';
content += 'The following rules have been implemented with assumed/demo values and need official confirmation against the Legal Metrology texts.\n\n';
content += '| Code | Label | Source Note | Fee (Demo) | Tolerance (Demo) |\n';
content += '|---|---|---|---|---|\n';

for (const rule of unverified) {
  content += `| ${rule.code} | ${rule.label} | ${rule.sourceNote} | ₹${rule.baseFeeDemo} | ${rule.tolerancesDemo} |\n`;
}

fs.writeFileSync(docPath, content);
