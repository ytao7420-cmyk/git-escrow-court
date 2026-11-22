export const JSON_BODY_LIMIT_BYTES = 32 * 1024;

export type LimitedJson =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413; error: string };

const OVER_LIMIT = "请求体超过 32KiB。";

function declaredLength(header: string | null): number | null {
  if (header === null) return null;
  if (!/^\d+$/.test(header) || header.length > 7) return null;
  return Number(header);
}

export async function readLimitedJson(request: Request, limit = JSON_BODY_LIMIT_BYTES): Promise<LimitedJson> {
  const declared = declaredLength(request.headers.get("content-length"));
  if (declared !== null && declared > limit) {
    await request.body?.cancel().catch(() => undefined);
    return { ok: false, status: 413, error: OVER_LIMIT };
  }

  const body = request.body;
  if (!body) return { ok: false, status: 400, error: "请求体不是 JSON。" };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const size = value?.byteLength ?? 0;
      if (size === 0) continue;
      if (total > limit - size) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413, error: OVER_LIMIT };
      }
      chunks.push(value);
      total += size;
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return { ok: false, status: 400, error: "请求体读取失败。" };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, status: 400, error: "请求体不是 UTF-8 JSON。" };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: "请求体不是 JSON。" };
  }
}
