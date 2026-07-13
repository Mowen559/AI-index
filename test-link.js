const fs = require('fs'); console.log('isSymbolicLink: ', fs.lstatSync('hub-web/.next/standalone/hub-web/node_modules/next').isSymbolicLink());
