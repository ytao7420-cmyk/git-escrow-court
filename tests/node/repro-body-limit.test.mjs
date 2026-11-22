process.env.REPRO_ENCODE_PUBLIC = "1";

import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../../src/app/api/repro-case/route.ts";
import { JSON_BODY_LIMIT_BYTES, readLimitedJson } from "../../src/lib/limited-json.ts";
import { createReproCaseId } from "../../src/lib/repro-shared.ts";

const SENDER = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9";
const CASE_ID = createReproCaseId(new Uint8Array(16).fill(7));
const LIMIT = JSON_BODY_LIMIT_BYTES;

function legalBody() {
  return JSON.stringify({ sender: SENDER, caseId: CASE_ID, broadcast: false });
}

function requestFromBytes(bytes, { headers = {}, chunkSize = bytes.byteLength } = {}) {
  let offset = 0;
  let pulls = 0;
  const stream = new ReadableStream({
    pull(controller) {
      pulls += 1;
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(bytes.byteLength, offset + chunkSize);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
  const request = new Request("http://127.0.0.1/api/repro-case", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  });
  return { request, pulls: () => pulls };
}

function bytesOf(text) {
  return new TextEncoder().encode(text);
}

function paddedLegal(byteLength) {
  const prefix = `{"sender":"${SENDER}","caseId":"${CASE_ID}","broadcast":false,"pad":"`;
  const suffix = `"}`;
  const padLength = byteLength - Buffer.byteLength(prefix) - Buffer.byteLength(suffix);
  assert.ok(padLength >= 0);
  return prefix + "a".repeat(padLength) + suffix;
}

test("a normal sender and case id still encodes without signing or broadcasting", async () => {
  const response = await POST(new Request("http://127.0.0.1/api/repro-case", {
    method: "POST",
    body: legalBody(),
  }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.signed, false);
  assert.equal(payload.broadcast, false);
  assert.equal(payload.value, "0x0");
  assert.equal(payload.caseId, CASE_ID);
  assert.equal(payload.selector, "0x27241a99");
});

test("exactly 32KiB is accepted and one more byte is rejected", async () => {
  const exact = bytesOf(paddedLegal(LIMIT));
  assert.equal(exact.byteLength, LIMIT);
  const exactResponse = await POST(requestFromBytes(exact).request);
  const exactPayload = await exactResponse.json();
  assert.equal(exactResponse.status, 200);
  assert.equal(exactPayload.broadcast, false);
  assert.equal(exactPayload.signed, false);
  assert.equal(exactPayload.value, "0x0");

  const over = new Uint8Array(LIMIT + 1);
  over.set(exact);
  over[LIMIT] = 0x61;
  const overResponse = await POST(requestFromBytes(over, { chunkSize: 1024 }).request);
  assert.equal(overResponse.status, 413);
});

test("the limit counts UTF-8 bytes and stops a streamed body early", async () => {
  const marker = "你";
  assert.equal(Buffer.byteLength(marker), 3);
  const chars = Math.ceil((LIMIT + 1) / 3);
  const text = `{"pad":"${marker.repeat(chars)}"}`;
  assert.ok(Buffer.byteLength(text) > LIMIT);
  assert.ok([...text].length < Buffer.byteLength(text));
  const utf = await readLimitedJson(new Request("http://127.0.0.1/api/repro-case", {
    method: "POST",
    body: text,
  }));
  assert.equal(utf.status, 413);

  let produced = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (produced >= 8) {
        controller.close();
        return;
      }
      produced += 1;
      controller.enqueue(new Uint8Array(16 * 1024).fill(0x61));
    },
  });
  const streamed = await readLimitedJson(new Request("http://127.0.0.1/api/repro-case", {
    method: "POST",
    body: stream,
    duplex: "half",
  }));
  assert.equal(streamed.status, 413);
  assert.ok(produced < 8);
  assert.ok(produced * 16 * 1024 > LIMIT);
});

test("missing, matching, and forged content lengths follow the bytes actually read", async () => {
  const small = bytesOf(legalBody());
  const missing = await POST(requestFromBytes(small).request);
  assert.equal(missing.status, 200);

  const matched = await POST(requestFromBytes(small, {
    headers: { "content-length": String(small.byteLength) },
  }).request);
  assert.equal(matched.status, 200);

  let pulls = 0;
  const huge = new ReadableStream({
    pull(controller) {
      pulls += 1;
      if (pulls > 40) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(4096).fill(0x62));
    },
  });
  const forgedSmall = await readLimitedJson(new Request("http://127.0.0.1/api/repro-case", {
    method: "POST",
    headers: { "content-length": "4" },
    body: huge,
    duplex: "half",
  }));
  assert.equal(forgedSmall.status, 413);
  assert.ok(pulls < 40);

  let declaredPulls = 0;
  const unused = new ReadableStream({
    pull(controller) {
      declaredPulls += 1;
      controller.enqueue(new Uint8Array(1024));
    },
  });
  const forgedLarge = await readLimitedJson(new Request("http://127.0.0.1/api/repro-case", {
    method: "POST",
    headers: { "content-length": "999999" },
    body: unused,
    duplex: "half",
  }));
  assert.equal(forgedLarge.status, 413);
  assert.equal(declaredPulls, 0);

  const unknown = await readLimitedJson(new Request("http://127.0.0.1/api/repro-case", {
    method: "POST",
    headers: { "content-length": "nope" },
    body: legalBody(),
  }));
  assert.equal(unknown.ok, true);
});

test("bad JSON under the limit stays a client error and does not encode", async () => {
  const response = await POST(new Request("http://127.0.0.1/api/repro-case", {
    method: "POST",
    body: "{",
  }));
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(Object.hasOwn(payload, "data"), false);

  const full = await POST(requestFromBytes(bytesOf("x".repeat(LIMIT))).request);
  assert.equal(full.status, 400);
});
