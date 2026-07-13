const fs = require('fs');
const path = require('path');

function flattenPnpm(standaloneDir) {
    const pnpmDir = path.join(standaloneDir, 'node_modules', '.pnpm');
    if (!fs.existsSync(pnpmDir)) return;

    const outModulesDir = path.join(standaloneDir, 'node_modules');
    
    // Read all packages in .pnpm
    const packages = fs.readdirSync(pnpmDir);
    for (const pkg of packages) {
        if (pkg.startsWith('.')) continue;
        
        const innerNodeModules = path.join(pnpmDir, pkg, 'node_modules');
        if (!fs.existsSync(innerNodeModules)) continue;
        
        const copyInner = (srcDir, destDir) => {
            const items = fs.readdirSync(srcDir);
            for (const item of items) {
                const srcPath = path.join(srcDir, item);
                const destPath = path.join(destDir, item);
                
                const stat = fs.lstatSync(srcPath);
                if (stat.isSymbolicLink()) {
                    // Skip symlinks completely! Node.js will find the package at the root outModulesDir
                    continue;
                }
                
                if (stat.isDirectory() && item.startsWith('@')) {
                    // It's a scope
                    copyInner(srcPath, destPath);
                } else if (stat.isDirectory()) {
                    if (!fs.existsSync(destPath)) {
                        fs.cpSync(srcPath, destPath, { recursive: true });
                        console.log('Flattened', destPath);
                    }
                } else {
                     if (!fs.existsSync(destPath)) {
                        fs.cpSync(srcPath, destPath);
                    }
                }
            }
        };
        copyInner(innerNodeModules, outModulesDir);
    }
}

flattenPnpm('D:/cloud/deepcloud/super agent/hub-web/.next/standalone');
