import { networkInterfaces } from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const port = url.port ? `:${url.port}` : "";
  const origins = readPrivateIpv4Addresses().map((address) => ({
    address,
    origin: `${proto}://${address}${port}`,
  }));

  return Response.json({ origins });
}

function readPrivateIpv4Addresses(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter((item) => item.family === "IPv4" && !item.internal && isPrivateIpv4(item.address))
    .map((item) => item.address);
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}
