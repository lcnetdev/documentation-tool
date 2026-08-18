import fs from 'fs';
import os from 'os';
import path from 'path';
import { savePastedImage, saveUploadedImage } from '../services/imageHandler.js';

// A real 1x1 transparent PNG — content must pass magic-byte validation
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
// Minimal JPEG header bytes (SOI + APP0 marker)
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

describe('imageHandler', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagehandler-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('savePastedImage', () => {
    it('decodes base64 and saves PNG file', () => {
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      );
      const base64Data = pngBuffer.toString('base64');

      const result = savePastedImage(tmpDir, base64Data, 'test-image.png');

      expect(result).toBe(path.join('images', 'test-image.png'));

      const savedPath = path.join(tmpDir, 'images', 'test-image.png');
      expect(fs.existsSync(savedPath)).toBe(true);
    });

    it('strips data URL prefix before decoding', () => {
      const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const dataUrl = `data:image/png;base64,${rawBase64}`;

      const result = savePastedImage(tmpDir, dataUrl, 'stripped.png');
      expect(result).toBe(path.join('images', 'stripped.png'));
      expect(fs.existsSync(path.join(tmpDir, 'images', 'stripped.png'))).toBe(true);
    });

    it('creates images directory if it does not exist', () => {
      const imagesDir = path.join(tmpDir, 'images');
      expect(fs.existsSync(imagesDir)).toBe(false);
      savePastedImage(tmpDir, PNG_BASE64, 'img.png');
      expect(fs.existsSync(imagesDir)).toBe(true);
    });

    it('generates a timestamped filename when none is provided', () => {
      savePastedImage(tmpDir, PNG_BASE64);
      const imagesDir = path.join(tmpDir, 'images');
      const files = fs.readdirSync(imagesDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^upload_\d{8}_\d{6}_\d{3}\.png$/);
    });

    it('rejects data that does not match the image type', () => {
      expect(() => savePastedImage(tmpDir, 'dGVzdA==', 'img.png')).toThrow(
        /does not match/
      );
    });

    it('forces a safe extension for disallowed types', () => {
      const result = savePastedImage(tmpDir, PNG_BASE64, 'evil.svg');
      expect(result).toBe(path.join('images', 'evil.png'));
    });
  });

  describe('saveUploadedImage', () => {
    it('moves uploaded file to images directory', () => {
      const uploadedFilePath = path.join(tmpDir, 'multer-tmp-file');
      fs.writeFileSync(uploadedFilePath, JPEG_BYTES);

      const file = {
        path: uploadedFilePath,
        originalname: 'photo.jpg',
      };

      const result = saveUploadedImage(tmpDir, file);
      expect(result).toBe(path.join('images', 'photo.jpg'));
      expect(fs.existsSync(uploadedFilePath)).toBe(false);

      const destPath = path.join(tmpDir, 'images', 'photo.jpg');
      expect(fs.existsSync(destPath)).toBe(true);
      expect(fs.readFileSync(destPath).equals(JPEG_BYTES)).toBe(true);
    });

    it('rejects disallowed extensions', () => {
      const uploadedFilePath = path.join(tmpDir, 'multer-tmp-svg');
      fs.writeFileSync(uploadedFilePath, '<svg onload="alert(1)"></svg>');

      const file = { path: uploadedFilePath, originalname: 'evil.svg' };
      expect(() => saveUploadedImage(tmpDir, file)).toThrow(/allowed/);
      // Temp file is cleaned up on rejection
      expect(fs.existsSync(uploadedFilePath)).toBe(false);
    });

    it('rejects files whose content does not match their extension', () => {
      const uploadedFilePath = path.join(tmpDir, 'multer-tmp-fake');
      fs.writeFileSync(uploadedFilePath, '<html><script>alert(1)</script></html>');

      const file = { path: uploadedFilePath, originalname: 'fake.png' };
      expect(() => saveUploadedImage(tmpDir, file)).toThrow(/does not match/);
      expect(fs.existsSync(uploadedFilePath)).toBe(false);
    });
  });
});
