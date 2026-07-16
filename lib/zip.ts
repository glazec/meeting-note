const textEncoder = new TextEncoder();

export type ZipEntry = {
  data: Uint8Array;
  name: string;
};

const ZIP_LOCAL_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_VERSION = 20;
const ZIP_UTF8_NAME_FLAG = 0x0800;
// 1980-01-01 in MS-DOS date encoding keeps archives byte-for-byte reproducible.
const ZIP_DOS_DATE = 0x21;

const crc32Table = buildCrc32Table();

function buildCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

export function crc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZipArchive(entries: ZipEntry[]) {
  const encodedEntries = entries.map((entry) => ({
    crc: crc32(entry.data),
    data: entry.data,
    name: textEncoder.encode(entry.name),
  }));
  const localSize = encodedEntries.reduce(
    (total, entry) => total + 30 + entry.name.length + entry.data.length,
    0,
  );
  const centralSize = encodedEntries.reduce(
    (total, entry) => total + 46 + entry.name.length,
    0,
  );
  const archive = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(archive.buffer);
  const localOffsets: number[] = [];
  let offset = 0;

  for (const entry of encodedEntries) {
    localOffsets.push(offset);
    view.setUint32(offset, ZIP_LOCAL_HEADER_SIGNATURE, true);
    view.setUint16(offset + 4, ZIP_VERSION, true);
    view.setUint16(offset + 6, ZIP_UTF8_NAME_FLAG, true);
    view.setUint16(offset + 8, 0, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, ZIP_DOS_DATE, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.data.length, true);
    view.setUint32(offset + 22, entry.data.length, true);
    view.setUint16(offset + 26, entry.name.length, true);
    view.setUint16(offset + 28, 0, true);
    archive.set(entry.name, offset + 30);
    archive.set(entry.data, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.data.length;
  }

  const centralStart = offset;

  encodedEntries.forEach((entry, index) => {
    view.setUint32(offset, ZIP_CENTRAL_HEADER_SIGNATURE, true);
    view.setUint16(offset + 4, ZIP_VERSION, true);
    view.setUint16(offset + 6, ZIP_VERSION, true);
    view.setUint16(offset + 8, ZIP_UTF8_NAME_FLAG, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, 0, true);
    view.setUint16(offset + 14, ZIP_DOS_DATE, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.data.length, true);
    view.setUint32(offset + 24, entry.data.length, true);
    view.setUint16(offset + 28, entry.name.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, localOffsets[index], true);
    archive.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  });

  view.setUint32(offset, ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, encodedEntries.length, true);
  view.setUint16(offset + 10, encodedEntries.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true);

  return archive;
}
