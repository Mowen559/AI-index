const fs = require('fs');
const path = require('path');

// 支持通过环境变量动态指定字典路径，如果未设置则默认使用本地相对路径
const GLOBAL_LOCALES_DIR = process.env.I18N_LOCALES_DIR || path.resolve(__dirname, '../../../deepcloud-i18n/locales');
const LOCAL_LOCALES_DIR = process.env.I18N_FRONTEND_DIR || path.resolve(__dirname, '../src/locales');

function syncLocales() {
    if (!fs.existsSync(GLOBAL_LOCALES_DIR)) {
        console.error(`Global locales directory not found: ${GLOBAL_LOCALES_DIR}`);
        return;
    }

    if (!fs.existsSync(LOCAL_LOCALES_DIR)) {
        fs.mkdirSync(LOCAL_LOCALES_DIR, { recursive: true });
    }

    const files = fs.readdirSync(GLOBAL_LOCALES_DIR);
    let count = 0;
    for (const file of files) {
        if (file.endsWith('.json')) {
            const srcPath = path.join(GLOBAL_LOCALES_DIR, file);
            const destPath = path.join(LOCAL_LOCALES_DIR, file);
            fs.copyFileSync(srcPath, destPath);
            count++;
        }
    }
    console.log(`Successfully synced ${count} locale files from global deepcloud-i18n.`);
}

syncLocales();
