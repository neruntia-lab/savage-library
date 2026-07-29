import assert from "node:assert/strict";
import test from "node:test";
import { webhookDeliveryDisposition } from "../app/api/patreon/webhook/route";

const now = Date.parse("2026-07-29T18:00:00.000Z");

test("new webhook deliveries are processed", () => {
  assert.equal(webhookDeliveryDisposition(undefined, now), "new");
});

test("completed webhook deliveries remain idempotent", () => {
  assert.equal(
    webhookDeliveryDisposition(
      {
        receivedAt: "2026-07-29T17:59:00.000Z",
        processedAt: "2026-07-29T17:59:01.000Z",
        error: null,
      },
      now,
    ),
    "duplicate",
  );
});

test("failed and abandoned webhook deliveries are retried", () => {
  assert.equal(
    webhookDeliveryDisposition(
      {
        receivedAt: "2026-07-29T17:59:00.000Z",
        processedAt: null,
        error: "Patreon was unavailable",
      },
      now,
    ),
    "retry",
  );
  assert.equal(
    webhookDeliveryDisposition(
      {
        receivedAt: "2026-07-29T17:50:00.000Z",
        processedAt: null,
        error: null,
      },
      now,
    ),
    "retry",
  );
});

test("concurrent webhook deliveries do not duplicate processing", () => {
  assert.equal(
    webhookDeliveryDisposition(
      {
        receivedAt: "2026-07-29T17:59:00.000Z",
        processedAt: null,
        error: null,
      },
      now,
    ),
    "in_progress",
  );
});
