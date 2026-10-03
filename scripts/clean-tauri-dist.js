const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', 'dist', 'frontend-angular', 'browser');

const files = ['ngsw-worker.js', 'ngsw.json', 'safety-worker.js', 'worker-basic.min.js'];
for (const file of files) {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`[clean-tauri-dist] Removed ${file}`);
    } catch (err) {
      console.warn(`[clean-tauri-dist] Could not remove ${file}:`, err);
    }
  }
}
