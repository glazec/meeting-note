import { describe, expect, it } from "vitest";

import { buildZipArchive, crc32 } from "@/lib/zip";

const textEncoder = new TextEncoder();

function readUint32(archive: Uint8Array, offset: number) {
  return new DataView(archive.buffer).getUint32(offset, true);
}

function readUint16(archive: Uint8Array, offset: number) {
  return new DataView(archive.buffer).getUint16(offset, true);
}

describe("crc32", () => {
  it("matches the standard CRC-32 checksum", () => {
    expect(crc32(textEncoder.encode("hello"))).toBe(0x3610a686);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("buildZipArchive", () => {
  it("stores entries with local headers, central directory, and end record", () => {
    const first = textEncoder.encode("first file body");
    const second = textEncoder.encode("second");
    const archive = buildZipArchive([
      { data: first, name: "a.txt" },
      { data: second, name: "b.txt" },
    ]);

    expect(readUint32(archive, 0)).toBe(0x04034b50);

    const secondLocalOffset = 30 + "a.txt".length + first.length;
    expect(readUint32(archive, secondLocalOffset)).toBe(0x04034b50);

    const centralStart = secondLocalOffset + 30 + "b.txt".length + second.length;
    expect(readUint32(archive, centralStart)).toBe(0x02014b50);

    const endRecordOffset = archive.length - 22;
    expect(readUint32(archive, endRecordOffset)).toBe(0x06054b50);
    expect(readUint16(archive, endRecordOffset + 10)).toBe(2);
    expect(readUint32(archive, endRecordOffset + 16)).toBe(centralStart);

    expect(readUint32(archive, 14)).toBe(crc32(first));
    expect(readUint32(archive, 18)).toBe(first.length);
    expect(readUint32(archive, 22)).toBe(first.length);
  });

  it("builds a valid empty archive", () => {
    const archive = buildZipArchive([]);

    expect(archive.length).toBe(22);
    expect(readUint32(archive, 0)).toBe(0x06054b50);
  });
});
