// sheet2.mjs <out.webp> <top.png> <bottom.png> : stack two rendered strips into one 1536 x 768 sheet (WebP, quality 82).
import sharp from 'sharp';
const [out, a, b] = process.argv.slice(2);
const A = await sharp(a).resize(1536, 384, { fit: 'fill' }).toBuffer(), B = await sharp(b).resize(1536, 384, { fit: 'fill' }).toBuffer();
await sharp({ create: { width: 1536, height: 768, channels: 3, background: '#000' } }).composite([{ input: A, left: 0, top: 0 }, { input: B, left: 0, top: 384 }]).webp({ quality: 82 }).toFile(out);
