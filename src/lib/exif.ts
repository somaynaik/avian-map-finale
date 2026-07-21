export type ExifLocation = {
  lat: number;
  lng: number;
};

export type ExifMetadata = {
  location: ExifLocation | null;
  capturedAt: string | null;
};

const JPEG_SOI = 0xffd8;
const APP1_MARKER = 0xffe1;
const EXIF_HEADER = "Exif\0\0";

const readAscii = (view: DataView, offset: number, length: number) => {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    const charCode = view.getUint8(offset + index);
    if (charCode === 0) break;
    value += String.fromCharCode(charCode);
  }
  return value;
};

const getTypeWidth = (type: number) => {
  switch (type) {
    case 1:
    case 2:
    case 7:
      return 1;
    case 3:
      return 2;
    case 4:
    case 9:
      return 4;
    case 5:
    case 10:
      return 8;
    default:
      return 0;
  }
};

const getIfdValueOffset = (
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  type: number,
  count: number,
  littleEndian: boolean,
) => {
  const inlineValueOffset = entryOffset + 8;
  const byteLength = getTypeWidth(type) * count;
  if (byteLength <= 4) {
    return inlineValueOffset;
  }

  return tiffStart + view.getUint32(entryOffset + 8, littleEndian);
};

const readRational = (view: DataView, offset: number, littleEndian: boolean) => {
  const numerator = view.getUint32(offset, littleEndian);
  const denominator = view.getUint32(offset + 4, littleEndian);
  if (denominator === 0) return 0;
  return numerator / denominator;
};

const dmsToDecimal = (degrees: number, minutes: number, seconds: number, ref: string) => {
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return ref === "S" || ref === "W" ? -decimal : decimal;
};

const parseExifDate = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return value;

  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

export async function readImageExif(file: File): Promise<ExifMetadata> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  if (view.byteLength < 4 || view.getUint16(0) !== JPEG_SOI) {
    return { location: null, capturedAt: null };
  }

  let offset = 2;

  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;

    if (marker === 0xffda || marker === 0xffd9) {
      break;
    }

    const segmentLength = view.getUint16(offset);
    if (segmentLength < 2 || offset + segmentLength > view.byteLength) {
      break;
    }

    if (marker === APP1_MARKER) {
      const segmentStart = offset + 2;
      const exifHeader = readAscii(view, segmentStart, EXIF_HEADER.length);
      if (exifHeader !== EXIF_HEADER) {
        offset += segmentLength;
        continue;
      }

      const tiffStart = segmentStart + EXIF_HEADER.length;
      const byteOrder = readAscii(view, tiffStart, 2);
      const littleEndian = byteOrder === "II";
      if (!littleEndian && byteOrder !== "MM") {
        return { location: null, capturedAt: null };
      }

      if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) {
        return { location: null, capturedAt: null };
      }

      const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
      const ifd0Offset = tiffStart + firstIfdOffset;
      if (ifd0Offset >= view.byteLength) {
        return { location: null, capturedAt: null };
      }

      const entryCount = view.getUint16(ifd0Offset, littleEndian);
      let gpsIfdPointer = 0;
      let exifIfdPointer = 0;

      for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
        const entryOffset = ifd0Offset + 2 + entryIndex * 12;
        const tag = view.getUint16(entryOffset, littleEndian);
        if (tag === 0x8825) {
          gpsIfdPointer = view.getUint32(entryOffset + 8, littleEndian);
        } else if (tag === 0x8769) {
          exifIfdPointer = view.getUint32(entryOffset + 8, littleEndian);
        }
      }

      let capturedAt: string | null = null;
      if (exifIfdPointer) {
        const exifIfdOffset = tiffStart + exifIfdPointer;
        const exifEntryCount = view.getUint16(exifIfdOffset, littleEndian);
        for (let entryIndex = 0; entryIndex < exifEntryCount; entryIndex += 1) {
          const entryOffset = exifIfdOffset + 2 + entryIndex * 12;
          const tag = view.getUint16(entryOffset, littleEndian);
          if (tag !== 0x9003) continue;
          const type = view.getUint16(entryOffset + 2, littleEndian);
          const count = view.getUint32(entryOffset + 4, littleEndian);
          const valueOffset = getIfdValueOffset(view, tiffStart, entryOffset, type, count, littleEndian);
          capturedAt = parseExifDate(readAscii(view, valueOffset, count));
          break;
        }
      }

      if (!gpsIfdPointer) {
        return { location: null, capturedAt };
      }

      const gpsIfdOffset = tiffStart + gpsIfdPointer;
      const gpsEntryCount = view.getUint16(gpsIfdOffset, littleEndian);

      let latRef = "";
      let lngRef = "";
      let latComponents: number[] | null = null;
      let lngComponents: number[] | null = null;

      for (let entryIndex = 0; entryIndex < gpsEntryCount; entryIndex += 1) {
        const entryOffset = gpsIfdOffset + 2 + entryIndex * 12;
        const tag = view.getUint16(entryOffset, littleEndian);
        const type = view.getUint16(entryOffset + 2, littleEndian);
        const count = view.getUint32(entryOffset + 4, littleEndian);
        const valueOffset = getIfdValueOffset(view, tiffStart, entryOffset, type, count, littleEndian);

        if (tag === 0x0001) {
          latRef = readAscii(view, valueOffset, count);
        } else if (tag === 0x0002 && count >= 3) {
          latComponents = [
            readRational(view, valueOffset, littleEndian),
            readRational(view, valueOffset + 8, littleEndian),
            readRational(view, valueOffset + 16, littleEndian),
          ];
        } else if (tag === 0x0003) {
          lngRef = readAscii(view, valueOffset, count);
        } else if (tag === 0x0004 && count >= 3) {
          lngComponents = [
            readRational(view, valueOffset, littleEndian),
            readRational(view, valueOffset + 8, littleEndian),
            readRational(view, valueOffset + 16, littleEndian),
          ];
        }
      }

      if (!latComponents || !lngComponents || !latRef || !lngRef) {
        return { location: null, capturedAt };
      }

      return {
        location: {
          lat: dmsToDecimal(latComponents[0], latComponents[1], latComponents[2], latRef),
          lng: dmsToDecimal(lngComponents[0], lngComponents[1], lngComponents[2], lngRef),
        },
        capturedAt,
      };
    }

    offset += segmentLength;
  }

  return { location: null, capturedAt: null };
}

export function getDistanceKm(a: ExifLocation, b: ExifLocation) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const haversine =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);

  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusKm * centralAngle;
}
