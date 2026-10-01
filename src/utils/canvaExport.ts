// Génère un fichier .pptx (OpenXML) 100% natif sans dépendance externe
// Chaque slide contient des calques séparés (fond, image, badge marque, titre, sous-titre, bullets, stat, footer)
// pour que Canva permette d'éditer chaque texte et chaque élément individuellement.

export interface CanvaSlideInput {
  slideNumber: number;
  tag: string;
  title: string;
  subtitle: string;
  bulletPoints?: string[];
  stat?: { value: string; label: string };
  image?: string;
  ctaText?: string;
}

export interface CanvaExportInput {
  title: string;
  widthPx: number;
  heightPx: number;
  slides: CanvaSlideInput[];
  brand: {
    name: string;
    handle: string;
    color: string;
    logo?: string | null;
  };
}

// CRC32 table for ZIP archive creation
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createZipBlob(files: { name: string; data: Uint8Array }[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);

    // Local file header (30 bytes + name)
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression: 0 = store
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x21, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    localParts.push(local, data);

    // Central directory header (46 bytes + name)
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    centralParts.push(central);
    offset += local.length + data.length;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd] as unknown as BlobPart[], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

const escXml = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const cleanHex = (hex: string) => hex.replace('#', '').toUpperCase().padEnd(6, '0').slice(0, 6);

// Convert pixels (at 96 DPI) to EMUs (1 inch = 914400 EMUs, 1 px = 9525 EMUs)
const px = (val: number) => Math.round(val * 9525);

function textBoxXml(opts: {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSizePt: number;
  colorHex: string;
  bold?: boolean;
  align?: 'l' | 'ctr' | 'r';
  fillHex?: string;
  borderHex?: string;
}) {
  const fillXml = opts.fillHex
    ? `<a:solidFill><a:srgbClr val="${cleanHex(opts.fillHex)}"/></a:solidFill>`
    : `<a:noFill/>`;
  const lnXml = opts.borderHex
    ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${cleanHex(opts.borderHex)}"/></a:solidFill></a:ln>`
    : `<a:ln><a:noFill/></a:ln>`;

  const lines = opts.text.split('\n');
  const paragraphsXml = lines
    .map(
      (line) => `<a:p>
        <a:pPr algn="${opts.align || 'l'}"/>
        <a:r>
          <a:rPr lang="fr-FR" sz="${Math.round(opts.fontSizePt * 100)}" b="${opts.bold ? '1' : '0'}" dirty="0">
            <a:solidFill><a:srgbClr val="${cleanHex(opts.colorHex)}"/></a:solidFill>
            <a:latin typeface="Poppins"/>
          </a:rPr>
          <a:t>${escXml(line)}</a:t>
        </a:r>
      </a:p>`
    )
    .join('');

  return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${opts.id}" name="${escXml(opts.name)}"/>
      <p:cNvSpPr txBox="1"/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm>
        <a:off x="${px(opts.x)}" y="${px(opts.y)}"/>
        <a:ext cx="${px(opts.w)}" cy="${px(opts.h)}"/>
      </a:xfrm>
      <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
      ${fillXml}
      ${lnXml}
    </p:spPr>
    <p:txBody>
      <a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="ctr"/>
      <a:lstStyle/>
      ${paragraphsXml}
    </p:txBody>
  </p:sp>`;
}

function buildSlideXml(
  slide: CanvaSlideInput,
  total: number,
  w: number,
  h: number,
  brand: { name: string; handle: string; color: string }
): string {
  const pad = 80;
  const contentW = w - pad * 2;
  const accent = cleanHex(brand.color || '#F59E0B');

  const shapes: string[] = [];

  // 1. Dark background rectangle (editable shape in Canva)
  shapes.push(`<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="2" name="Fond du Slide"/>
      <p:cNvSpPr/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="0" y="0"/><a:ext cx="${px(w)}" cy="${px(h)}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:solidFill><a:srgbClr val="18181B"/></a:solidFill>
      <a:ln><a:noFill/></a:ln>
    </p:spPr>
  </p:sp>`);

  // 2. Brand Badge + Name + Slide Counter
  shapes.push(
    textBoxXml({
      id: 3,
      name: 'Badge Marque',
      x: pad,
      y: 70,
      w: 56,
      h: 56,
      text: brand.name.slice(0, 2).toUpperCase(),
      fontSizePt: 16,
      colorHex: '000000',
      bold: true,
      align: 'ctr',
      fillHex: accent,
    }),
    textBoxXml({
      id: 4,
      name: 'Nom de Marque',
      x: pad + 70,
      y: 74,
      w: 420,
      h: 48,
      text: brand.name.toUpperCase(),
      fontSizePt: 18,
      colorHex: 'FFFFFF',
      bold: true,
    }),
    textBoxXml({
      id: 5,
      name: 'Numéro de Slide',
      x: w - pad - 160,
      y: 74,
      w: 160,
      h: 48,
      text: `${String(slide.slideNumber).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
      fontSizePt: 16,
      colorHex: accent,
      bold: true,
      align: 'r',
    })
  );

  // 3. Tag / Kicker
  let yCursor = Math.round(h * 0.22);
  shapes.push(
    textBoxXml({
      id: 6,
      name: 'Catégorie / Tag',
      x: pad,
      y: yCursor,
      w: contentW,
      h: 44,
      text: slide.tag.toUpperCase(),
      fontSizePt: 16,
      colorHex: accent,
      bold: true,
    })
  );
  yCursor += 56;

  // 4. Main Headline (Title)
  shapes.push(
    textBoxXml({
      id: 7,
      name: 'Titre Principal (Éditable)',
      x: pad,
      y: yCursor,
      w: contentW,
      h: 210,
      text: slide.title,
      fontSizePt: h > w ? 44 : 38,
      colorHex: 'FFFFFF',
      bold: true,
    })
  );
  yCursor += 225;

  // 5. Subtitle
  shapes.push(
    textBoxXml({
      id: 8,
      name: 'Sous-titre (Éditable)',
      x: pad,
      y: yCursor,
      w: contentW,
      h: 130,
      text: slide.subtitle,
      fontSizePt: 21,
      colorHex: 'D4D4D8',
    })
  );
  yCursor += 145;

  // 6. Optional Stat Block
  if (slide.stat) {
    shapes.push(
      textBoxXml({
        id: 9,
        name: 'Chiffre Clé (Stat)',
        x: pad,
        y: yCursor,
        w: contentW,
        h: 110,
        text: slide.stat.value,
        fontSizePt: 54,
        colorHex: accent,
        bold: true,
        fillHex: '09090B',
        borderHex: accent,
      }),
      textBoxXml({
        id: 10,
        name: 'Légende Statistique',
        x: pad,
        y: yCursor + 115,
        w: contentW,
        h: 65,
        text: slide.stat.label,
        fontSizePt: 17,
        colorHex: 'A1A1AA',
      })
    );
    yCursor += 195;
  }

  // 7. Optional Bullet Points (each bullet is editable)
  if (slide.bulletPoints && slide.bulletPoints.length > 0) {
    const bulletsText = slide.bulletPoints.map((bp) => `✓  ${bp}`).join('\n');
    shapes.push(
      textBoxXml({
        id: 11,
        name: 'Liste à puces (Éditable)',
        x: pad,
        y: yCursor,
        w: contentW,
        h: Math.min(240, slide.bulletPoints.length * 68),
        text: bulletsText,
        fontSizePt: 20,
        colorHex: 'E4E4E7',
      })
    );
  }

  // 8. Footer Handle & CTA
  shapes.push(
    textBoxXml({
      id: 12,
      name: 'Identifiant (@handle)',
      x: pad,
      y: h - 130,
      w: 400,
      h: 54,
      text: brand.handle,
      fontSizePt: 18,
      colorHex: 'FFFFFF',
      bold: true,
    })
  );

  if (slide.ctaText) {
    shapes.push(
      textBoxXml({
        id: 13,
        name: 'Bouton CTA (Éditable)',
        x: w - pad - 420,
        y: h - 132,
        w: 420,
        h: 58,
        text: slide.ctaText,
        fontSizePt: 16,
        colorHex: accent,
        bold: true,
        align: 'r',
      })
    );
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${shapes.join('\n')}
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

export function createEditableCanvaPptx(input: CanvaExportInput): Blob {
  const enc = new TextEncoder();
  const { widthPx, heightPx, slides, brand } = input;

  const slideContentTypes = slides
    .map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join('\n  ');

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  ${slideContentTypes}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

  const slideRelsEntries = slides
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    )
    .join('\n  ');

  const presentationRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRelsEntries}
</Relationships>`;

  const sldIdEntries = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`)
    .join('\n    ');

  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${sldIdEntries}
  </p:sldIdLst>
  <p:sldSz cx="${px(widthPx)}" cy="${px(heightPx)}"/>
  <p:notesSz cx="${px(heightPx)}" cy="${px(widthPx)}"/>
</p:presentation>`;

  const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;

  const slideMasterRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

  const slideLayoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`;

  const slideLayoutRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

  const singleSlideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

  const files: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypesXml) },
    { name: '_rels/.rels', data: enc.encode(rootRelsXml) },
    { name: 'ppt/presentation.xml', data: enc.encode(presentationXml) },
    { name: 'ppt/_rels/presentation.xml.rels', data: enc.encode(presentationRelsXml) },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: enc.encode(slideMasterXml) },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: enc.encode(slideMasterRelsXml) },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: enc.encode(slideLayoutXml) },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: enc.encode(slideLayoutRelsXml) },
  ];

  slides.forEach((sl, idx) => {
    const xml = buildSlideXml(sl, slides.length, widthPx, heightPx, brand);
    files.push({ name: `ppt/slides/slide${idx + 1}.xml`, data: enc.encode(xml) });
    files.push({ name: `ppt/slides/_rels/slide${idx + 1}.xml.rels`, data: enc.encode(singleSlideRelsXml) });
  });

  return createZipBlob(files);
}
