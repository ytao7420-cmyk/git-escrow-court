export async function readResponseJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const text = await response.text();
  if (!text.trim()) {
    return { ok: false, error: `接口返回空内容（HTTP ${response.status}）。没有把它当成链上结果。` };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: `接口返回的不是 JSON（HTTP ${response.status}）。没有把它当成链上结果。` };
  }
}
