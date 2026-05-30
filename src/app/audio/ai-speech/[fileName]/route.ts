import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_CACHE_ROOT = path.resolve(process.cwd(), "public", "audio", "ai-speech");

const AUDIO_CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export async function GET(_request: Request, { params }: { params: Promise<{ fileName: string }> }) {
  const { fileName } = await params;
  const filePath = resolveAiSpeechAudioCachePath(fileName);
  if (!filePath) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(filePath);
    return new Response(data, {
      headers: buildAiSpeechAudioHeaders(fileName, data.byteLength),
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ fileName: string }> }) {
  const { fileName } = await params;
  const filePath = resolveAiSpeechAudioCachePath(fileName);
  if (!filePath) return new Response(null, { status: 404 });

  try {
    const info = await stat(filePath);
    return new Response(null, {
      headers: buildAiSpeechAudioHeaders(fileName, info.size),
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export function resolveAiSpeechAudioCachePath(fileName: string): string | null {
  if (!/^[A-Za-z0-9._-]+\.(mp3|wav)$/i.test(fileName)) return null;

  const filePath = path.resolve(AUDIO_CACHE_ROOT, fileName);
  if (filePath !== AUDIO_CACHE_ROOT && !filePath.startsWith(`${AUDIO_CACHE_ROOT}${path.sep}`)) return null;
  if (!AUDIO_CONTENT_TYPES[path.extname(filePath).toLowerCase()]) return null;
  return filePath;
}

export function getAiSpeechAudioContentType(fileName: string): string {
  return AUDIO_CONTENT_TYPES[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";
}

function buildAiSpeechAudioHeaders(fileName: string, contentLength: number): HeadersInit {
  return {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Length": String(contentLength),
    "Content-Type": getAiSpeechAudioContentType(fileName),
  };
}
