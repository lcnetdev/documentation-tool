const fs = require('fs');
const path = require('path');

/**
 * Save a multer-uploaded file to the repo's images/ directory.
 * Returns the relative path suitable for use in markdown.
 */
function saveUploadedImage(repoPath, file) {
  const imagesDir = path.join(repoPath, 'images');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const destPath = path.join(imagesDir, file.originalname);
  fs.renameSync(file.path, destPath);

  return path.join('images', file.originalname);
}

/**
 * Decode a base64 image and save it as a PNG to the repo's images/ directory.
 * If no filename is provided, generates one using the current timestamp.
 * Returns the relative path suitable for use in markdown.
 */
function savePastedImage(repoPath, base64Data, filename) {
  const imagesDir = path.join(repoPath, 'images');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // Generate filename if not provided
  if (!filename) {
    const now = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const timestamp = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      '_',
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
      '_',
      pad(now.getMilliseconds(), 3),
    ].join('');
    filename = `upload_${timestamp}.png`;
  }

  // Strip data URL prefix if present (e.g., "data:image/png;base64,")
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');

  const destPath = path.join(imagesDir, filename);
  fs.writeFileSync(destPath, buffer);

  return path.join('images', filename);
}

module.exports = { saveUploadedImage, savePastedImage };
