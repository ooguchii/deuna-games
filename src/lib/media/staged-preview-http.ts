import "server-only";

import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";

function requestedRange(
  request: NextRequest,
  totalBytes: number
) {
  const value = request.headers.get("range");
  if (!value) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) return "invalid" as const;

  const startText = match[1] ?? "";
  const endText = match[2] ?? "";

  if (!startText && !endText) {
    return "invalid" as const;
  }

  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) {
      return "invalid" as const;
    }

    return {
      start: Math.max(0, totalBytes - suffix),
      end: totalBytes - 1,
    };
  }

  const start = Number(startText);
  const requestedEnd = endText
    ? Number(endText)
    : totalBytes - 1;

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= totalBytes
  ) {
    return "invalid" as const;
  }

  return {
    start,
    end: Math.min(requestedEnd, totalBytes - 1),
  };
}

export function serveStagedPreviewFile(
  request: NextRequest,
  file: {
    filePath: string;
    bytes: number;
    contentType: string;
  },
  headOnly: boolean
) {
  const range = requestedRange(request, file.bytes);
  const sharedHeaders = {
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type": file.contentType,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
  };

  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: {
        ...sharedHeaders,
        "Content-Range": `bytes */${file.bytes}`,
      },
    });
  }

  if (range) {
    const length = range.end - range.start + 1;
    const body = headOnly
      ? null
      : Readable.toWeb(
          createReadStream(file.filePath, {
            start: range.start,
            end: range.end,
          })
        );

    return new Response(
      body as ReadableStream<Uint8Array> | null,
      {
        status: 206,
        headers: {
          ...sharedHeaders,
          "Content-Length": String(length),
          "Content-Range":
            `bytes ${range.start}-${range.end}/${file.bytes}`,
        },
      }
    );
  }

  const body = headOnly
    ? null
    : Readable.toWeb(createReadStream(file.filePath));

  return new Response(
    body as ReadableStream<Uint8Array> | null,
    {
      status: 200,
      headers: {
        ...sharedHeaders,
        "Content-Length": String(file.bytes),
      },
    }
  );
}
