import fs from 'node:fs';
import { X_S_TIER, X_A_TIER, X_B_TIER } from '../src/x-accounts.mjs';

const d = JSON.parse(fs.readFileSync('public/news.json', 'utf8'));
console.log('items:', d.items.length);
console.log('S tier pool:', X_S_TIER.length, 'A tier pool:', X_A_TIER.length, 'B tier pool:', X_B_TIER.length);

const inS = new Set(X_S_TIER.map(s => s.toLowerCase()));
const inA = new Set(X_A_TIER.map(s => s.toLowerCase()));
const inB = new Set(X_B_TIER.map(s => s.toLowerCase()));

const seen = {};
d.items.forEach(it => { seen[it.author] = (seen[it.author] || 0) + 1; });
const list = Object.entries(seen).sort((a, b) => b[1] - a[1]);

console.log('\nAccounts appearing in current data:');
let sCnt = 0, aCnt = 0, bCnt = 0, otherCnt = 0;
list.forEach(([k, v]) => {
  const t = inS.has(k.toLowerCase()) ? 'S' : inA.has(k.toLowerCase()) ? 'A' : inB.has(k.toLowerCase()) ? 'B' : '?';
  if (t === 'S') sCnt++; else if (t === 'A') aCnt++; else if (t === 'B') bCnt++; else otherCnt++;
  console.log(`  ${k} [${t}] x${v}`);
});
console.log(`\nBy tier: S=${sCnt} A=${aCnt} B=${bCnt} other=${otherCnt}`);
console.log('Data generated at:', d.generatedAt);
