import { inflateRawSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";

type ZipEntry = {
  compressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
  name: string;
};

type XmlNode = string | number | boolean | null | XmlObject | XmlNode[];

type XmlObject = {
  [key: string]: XmlNode | undefined;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

const xmlParser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  textNodeName: "#text",
  trimValues: false,
});

function asObject(value: XmlNode | undefined): XmlObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function asArray(value: XmlNode | undefined): XmlNode[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function stringValue(value: XmlNode | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(stringValue).join("");
  }

  return stringValue(value["#text"]);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  throw new Error("XLSX central directory was not found.");
}

function readZipEntries(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Invalid XLSX central directory entry.");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");

    entries.set(name, {
      compressedSize,
      compressionMethod,
      localHeaderOffset,
      name,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipFile(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;

  if (buffer.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`Invalid XLSX local file header: ${entry.name}`);
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(
    dataOffset,
    dataOffset + entry.compressedSize,
  );

  if (entry.compressionMethod === 0) {
    return compressed;
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressed);
  }

  throw new Error(`Unsupported XLSX compression method: ${entry.name}`);
}

function parseXml(buffer: Buffer) {
  return xmlParser.parse(buffer.toString("utf8")) as XmlObject;
}

function richTextValue(node: XmlObject | null): string {
  if (!node) {
    return "";
  }

  const direct = stringValue(node.t);

  if (direct) {
    return direct;
  }

  return asArray(node.r)
    .map((run) => stringValue(asObject(run)?.t))
    .join("");
}

function readSharedStrings(entries: Map<string, ZipEntry>, buffer: Buffer) {
  const entry = entries.get("xl/sharedStrings.xml");

  if (!entry) {
    return [];
  }

  const root = parseXml(readZipFile(buffer, entry));
  const sharedStringTable = asObject(root.sst);

  return asArray(sharedStringTable?.si).map((item) =>
    richTextValue(asObject(item)),
  );
}

function columnIndex(reference: string) {
  const match = /^[A-Z]+/i.exec(reference);

  if (!match) {
    return 0;
  }

  return (
    [...match[0].toUpperCase()].reduce(
      (total, character) => total * 26 + character.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

function cellValue(cell: XmlObject, sharedStrings: string[]): string {
  const type = stringValue(cell.t);

  if (type === "s") {
    const index = Number(stringValue(cell.v));
    return Number.isInteger(index) ? (sharedStrings[index] ?? "") : "";
  }

  if (type === "inlineStr") {
    return richTextValue(asObject(cell.is));
  }

  return stringValue(cell.v);
}

export function parseFirstWorksheetRows(buffer: Buffer) {
  const entries = readZipEntries(buffer);
  const sheetEntry = entries.get("xl/worksheets/sheet1.xml");

  if (!sheetEntry) {
    throw new Error("XLSX first worksheet was not found.");
  }

  const sharedStrings = readSharedStrings(entries, buffer);
  const root = parseXml(readZipFile(buffer, sheetEntry));
  const worksheet = asObject(root.worksheet);
  const sheetData = asObject(worksheet?.sheetData);

  return asArray(sheetData?.row).map((rowNode) => {
    const row = asObject(rowNode);
    const cells = asArray(row?.c);
    const values: string[] = [];

    for (const cellNode of cells) {
      const cell = asObject(cellNode);

      if (!cell) {
        continue;
      }

      const reference = stringValue(cell.r);
      values[columnIndex(reference)] = cellValue(cell, sharedStrings);
    }

    return values.map((value) => value ?? "");
  });
}
