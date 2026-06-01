import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_ROOT = path.resolve(process.cwd(), "local-assets", "class-trial-pack");

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

export async function GET(_request: Request, { params }: { params: Promise<{ assetPath: string[] }> }) {
  const { assetPath } = await params;
  const filePath = resolveClassTrialPackPath(assetPath);
  if (!filePath) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
    return new Response(data, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": contentType,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export function resolveClassTrialPackPath(assetPath: string[]): string | null {
  if (!assetPath.length) return null;
  if (assetPath.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) {
    return null;
  }

  const filePath = path.resolve(ASSET_ROOT, ...assetPath);
  if (filePath !== ASSET_ROOT && !filePath.startsWith(`${ASSET_ROOT}${path.sep}`)) return null;
  if (!CONTENT_TYPES[path.extname(filePath).toLowerCase()]) return null;
  return filePath;
}
