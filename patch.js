const fs = require('fs');
let content = fs.readFileSync('src/components/ui/chart.tsx', 'utf8');
content = content.replace(/\\\`  --color-\$\\\{key\}: \\\$\{color\};\\\`/g, '\`  --color-${key}: ${color};\`');
fs.writeFileSync('src/components/ui/chart.tsx', content);
