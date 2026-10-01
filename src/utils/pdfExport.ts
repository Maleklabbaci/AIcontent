// Générateur PDF 100% natif (aucune dépendance) : assemble des pages JPEG en un seul PDF.
// Chaque page = 1 slide rendu par le canvas de l'app.

export interface PdfPageInput {
  jpegBytes: Uint8Array;
  widthPt: number;
  heightPt: number;
  widthPx: number;
  heightPx: number;
}

const latin1 = (str: string): Uint8Array => {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  return bytes;
};

export function createPdfFromJpegs(pages: PdfPageInput[]): Blob {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (bytes: Uint8Array) => {
    parts.push(bytes);
    pos += bytes.length;
  };
  const pushStr = (s: string) => push(latin1(s));
  const beginObj = (num: number) => {
    offsets[num] = pos;
    pushStr(`${num} 0 obj\n`);
  };

  pushStr('%PDF-1.4\n%âãÏÓ\n');

  const n = pages.length;

  // Objet 1 : catalogue
  beginObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Objet 2 : arbre des pages
  beginObj(2);
  pushStr(
    `<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${4 + 3 * i} 0 R`).join(' ')}] >>\nendobj\n`
  );

  pages.forEach((pg, i) => {
    const imgObj = 3 + 3 * i;
    const pageObj = 4 + 3 * i;
    const contentObj = 5 + 3 * i;

    // Image JPEG (DCTDecode = JPEG natif du format PDF)
    beginObj(imgObj);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${pg.widthPx} /Height ${pg.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpegBytes.length} >>\nstream\n`
    );
    push(pg.jpegBytes);
    pushStr('\nendstream\nendobj\n');

    // Page
    beginObj(pageObj);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pg.widthPt} ${pg.heightPt}] /Resources << /XObject << /Im${i} ${imgObj} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`
    );

    // Flux de contenu : dessine l'image sur toute la page
    const stream = `q\n${pg.widthPt} 0 0 ${pg.heightPt} 0 0 cm\n/Im${i} Do\nQ`;
    beginObj(contentObj);
    pushStr(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  });

  // Table xref
  const xrefPos = pos;
  const total = 3 + 3 * n;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pushStr(xref);
  pushStr(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return new Blob(parts as unknown as BlobPart[], { type: 'application/pdf' });
}

// Convertit des pixels (96 DPI) en points PDF (72 DPI)
export const pxToPt = (px: number) => Math.round(px * 0.75);
