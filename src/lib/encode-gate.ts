export const MAX_CONCURRENT_ENCODES = 2;

let active = 0;

export function encodePublicEnabled(): boolean {
  return process.env.REPRO_ENCODE_PUBLIC === "1";
}

export async function withEncodeSlot<T>(work: () => Promise<T>): Promise<
  | { ok: true; value: T }
  | { ok: false; status: 429; error: string }
> {
  if (active >= MAX_CONCURRENT_ENCODES) {
    return {
      ok: false,
      status: 429,
      error: "这一进程里的编码并发已满。这只对当前 serverless 实例有效，冷启动会清零，不是跨实例的全局限流。",
    };
  }
  active += 1;
  try {
    return { ok: true, value: await work() };
  } finally {
    active -= 1;
  }
}
