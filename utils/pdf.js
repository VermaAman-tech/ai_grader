const fs = require('fs');

function bufferLooksLikePdf(buf) {
  if (!buf || buf.length < 4) return false;
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
}

function fileLooksLikePdf(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    return bufferLooksLikePdf(buf);
  } catch {
    return false;
  }
}

module.exports = { bufferLooksLikePdf, fileLooksLikePdf };
