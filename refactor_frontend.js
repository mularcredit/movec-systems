const fs = require('fs');
const path = require('path');

const files = [
    'src/App.tsx',
    'src/pages/Settings.tsx',
    'src/pages/Customers/ActiveUsers.tsx',
    'src/pages/Customers/AddCustomer.tsx',
    'src/pages/Customers/AllUsers.tsx',
    'src/pages/Dashboard.tsx',
    'src/pages/Network/Routers/RoutersList.tsx',
    'src/pages/Network/Routers/RouterDetail.tsx',
    'src/pages/Payments.tsx',
    'src/pages/Packages/AddPackage.tsx',
    'src/pages/Communication/Communication.tsx'
];

files.forEach(f => {
    const p = path.join('/Users/mac/Desktop/ISP BILLING/frontend', f);
    let content = fs.readFileSync(p, 'utf8');
    
    // Calculate relative path to src/lib/apiClient.ts
    // e.g. src/App.tsx -> depth 0 -> ./lib/apiClient
    // src/pages/Settings.tsx -> depth 1 -> ../lib/apiClient
    // src/pages/Customers/ActiveUsers.tsx -> depth 2 -> ../../lib/apiClient
    const depth = f.split('/').length - 2; // src/ is 1, App.tsx is 1. len=2. 2-2=0. 
    // Wait, path is src/pages/... => depth = 3 - 2 = 1 => '../lib/apiClient'
    // src/pages/Customers/... => depth = 4 - 2 = 2 => '../../lib/apiClient'
    let relative = depth === 0 ? './lib/apiClient' : '../'.repeat(depth) + 'lib/apiClient';
    
    if (!content.includes('apiFetch')) {
        const importStmt = `import { apiFetch } from '${relative}';\n`;
        const lines = content.split('\n');
        let lastImport = 0;
        for(let i=0; i<lines.length; i++) {
            if(lines[i].startsWith('import ')) lastImport = i;
        }
        content = lines.slice(0, lastImport+1).join('\n') + '\n' + importStmt + lines.slice(lastImport+1).join('\n');
    }

    content = content.replace(/\bfetch\(/g, 'apiFetch(');

    fs.writeFileSync(p, content, 'utf8');
    console.log(`Refactored ${f}`);
});
