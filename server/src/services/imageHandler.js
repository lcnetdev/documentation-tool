const fs = require('fs');
const path = require('path');

// Only common raster formats. SVG/HTML are excluded — they execute script
// when opened same-origin.
const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

const MAGIC_BYTES = {
  '.png': [[0x89, 0x50, 0x4e, 0x47]],
  '.jpg': [[0xff, 0xd8, 0xff]],
  '.jpeg': [[0xff, 0xd8, 0xff]],
  '.gif': [[0x47, 0x49, 0x46, 0x38]],
  '.webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF; bytes 8-11 checked separately
};

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/**
 * Verify a buffer's leading bytes match the file signature for its extension.
 */
function matchesMagicBytes(buffer, ext) {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures) return false;
  const ok = signatures.some((sig) =>
    sig.every((byte, i) => buffer.length > i && buffer[i] === byte)
  );
  if (!ok) return false;
  if (ext === '.webp') {
    return buffer.length > 11 && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return true;
}

/**
 * Save a multer-uploaded file to the repo's images/ directory.
 * Returns the relative path suitable for use in markdown.
 */
function saveUploadedImage(repoPath, file) {
  const imagesDir = path.join(repoPath, 'images');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // Sanitize filename: use only the basename to prevent path traversal
  let filename = path.basename(file.originalname);
  const ext = path.extname(filename).toLowerCase();
  const base = path.basename(filename, path.extname(filename));

  if (!ALLOWED_EXTS.has(ext)) {
    try { fs.unlinkSync(file.path); } catch {}
    throw badRequest('Only png, jpg, jpeg, gif, and webp images are allowed');
  }

  // Reject files whose content doesn't match their claimed image type
  const header = Buffer.alloc(12);
  const fd = fs.openSync(file.path, 'r');
  try {
    fs.readSync(fd, header, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (!matchesMagicBytes(header, ext)) {
    try { fs.unlinkSync(file.path); } catch {}
    throw badRequest('File content does not match its image type');
  }

  if (base.toLowerCase() === 'image' || fs.existsSync(path.join(imagesDir, filename))) {
    const now = Date.now();
    filename = base + '-' + now + ext;
  }

  const destPath = path.join(imagesDir, filename);
  // Use copy+unlink instead of rename to work across Docker volume mounts
  fs.copyFileSync(file.path, destPath);
  fs.unlinkSync(file.path);

  return path.join('images', filename);
}

/**
 * Decode a base64 image and save it to the repo's images/ directory.
 * If no filename is provided, generates one using the current timestamp.
 * Returns the relative path suitable for use in markdown.
 */
function savePastedImage(repoPath, base64Data, filename) {
  const imagesDir = path.join(repoPath, 'images');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // Generate filename if not provided, using the data-URL mime type
  if (!filename) {
    const mimeMatch = base64Data.match(/^data:image\/(\w+);base64,/);
    const mimeExt = mimeMatch ? '.' + mimeMatch[1].toLowerCase().replace('jpg', 'jpeg') : '.png';
    const genExt = ALLOWED_EXTS.has(mimeExt) ? mimeExt : '.png';
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
    filename = `upload_${timestamp}${genExt}`;
  }

  // Sanitize filename: use only the basename to prevent path traversal
  filename = path.basename(filename);

  // Force an allowed raster extension — never persist .svg/.html/etc.
  let ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    filename = path.basename(filename, path.extname(filename)) + '.png';
    ext = '.png';
  }

  // Strip data URL prefix if present (e.g., "data:image/png;base64,")
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');

  if (buffer.length > 10 * 1024 * 1024) {
    throw badRequest('Image is too large (max 10 MB)');
  }
  if (!matchesMagicBytes(buffer, ext)) {
    throw badRequest('Image data does not match its image type');
  }

  const destPath = path.join(imagesDir, filename);

  // Verify resolved path stays inside imagesDir
  const resolved = path.resolve(destPath);
  if (!resolved.startsWith(path.resolve(imagesDir) + path.sep)) {
    throw new Error('Invalid filename');
  }

  fs.writeFileSync(destPath, buffer);

  return path.join('images', filename);
}

module.exports = { saveUploadedImage, savePastedImage };
