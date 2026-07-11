const fs = require('node:fs');
const path = require('node:path');

const buildInfo = { buildTime: new Date().toISOString() };
const outPath = path.join(__dirname, '..', 'build-info.json');

fs.writeFileSync(outPath, JSON.stringify(buildInfo));
console.log(`Wrote ${outPath}: ${buildInfo.buildTime}`);
