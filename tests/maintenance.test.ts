import assert from "node:assert/strict";
import test from "node:test";
import { completedWebhookCutoff } from "../lib/services/maintenance";

test("completed webhook retention cutoff is 90 days", () => {
  assert.equal(
    completedWebhookCutoff(new Date("2026-08-11T12:00:00.000Z")),
    "2026-05-13T12:00:00.000Z",
  );
});
