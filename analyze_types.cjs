const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, 'packages');

function walkDir(dir) {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkDir(fullPath));
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

const typeMap = new Map();

for (const file of walkDir(packagesDir)) {
    const content = fs.readFileSync(file, 'utf8');
    const regex = /^(?:export\s+)?(?:interface|type)\s+([A-Za-z0-9_]+)/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const typeName = match[1];
        if (!typeMap.has(typeName)) {
            typeMap.set(typeName, []);
        }
        typeMap.get(typeName).push(file);
    }
}

let output = '';
for (const [typeName, files] of typeMap.entries()) {
    if (files.length > 1) {
        output += `${typeName} is defined in:\n`;
        files.forEach(f => {
            output += `  - ${path.relative(__dirname, f)}\n`;
        });
        output += '\n';
    } else {
         output += `${typeName} is defined once in:\n  - ${path.relative(__dirname, files[0])}\n\n`;
    }
}
fs.writeFileSync(path.join(__dirname, 'scratch_types.txt'), output);
