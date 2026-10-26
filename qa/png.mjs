// QA 用の最小限の PNG デコーダ（スクリーンショットのピクセル色を調べるため。8bit RGBA / RGB のみ対応）
import { inflateSync } from "node:zlib";

export const PNG = {
  decode(buf) {
    let pos = 8;
    let width = 0;
    let height = 0;
    let colorType = 6;
    const idat = [];
    while (pos < buf.length) {
      const len = buf.readUInt32BE(pos);
      const type = buf.toString("ascii", pos + 4, pos + 8);
      const data = buf.subarray(pos + 8, pos + 8 + len);
      if (type === "IHDR") {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        colorType = data[9];
      } else if (type === "IDAT") idat.push(data);
      pos += 12 + len;
    }
    const bpp = colorType === 6 ? 4 : 3;
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * bpp;
    const out = Buffer.alloc(height * stride);
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)];
      const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? out[y * stride + x - bpp] : 0;
        const b = y > 0 ? out[(y - 1) * stride + x] : 0;
        const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
        let v = line[x];
        if (filter === 1) v += a;
        else if (filter === 2) v += b;
        else if (filter === 3) v += (a + b) >> 1;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        out[y * stride + x] = v & 0xff;
      }
    }
    return { width, height, at: (x, y) => [...out.subarray((y * width + x) * bpp, (y * width + x) * bpp + bpp)] };
  },
};
