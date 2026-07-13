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
        
        // Sometimes scoped packages are inside
        const copyInner = (srcDir, destDir) => {
            const items = fs.readdirSync(srcDir);
            for (const item of items) {
                if (item.startsWith('@')) {
                    // It's a scope
                    copyInner(path.join(srcDir, item), path.join(destDir, item));
                } else {
                    const srcPath = path.join(srcDir, item);
                    const destPath = path.join(destDir, item);
                    if (!fs.existsSync(destPath)) {
                        fs.cpSync(srcPath, destPath, { recursive: true, dereference: true });
                        console.log('Flattened', destPath);
                    }
                }
            }
        };
        copyInner(innerNodeModules, outModulesDir);
    }
}

flattenPnpm('D:/cloud/deepcloud/super agent/hub-web/.next/standalone');
