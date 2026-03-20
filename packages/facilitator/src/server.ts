import http from "node:http";
import { RadixPaymentPayload, RadixPaymentRequirements } from "@x402/radix-core";
import { verifyRadixPayment } from "@x402/radix-server";
import { loadConfig } from "./config.js";
import { GasBudgetTracker } from "./gas-budget.js";
import { InMemoryReplayStore } from "./replay-store.js";
import { settleSponsored, settleNonSponsored, getCurrentEpoch } from "./settle.js";

const config = loadConfig();
const replayStore = new InMemoryReplayStore();
const gasBudget = new GasBudgetTracker(
  config.maxGasPerRequestXrd,
  config.maxGasPerWindowXrd,
  config.windowDurationSeconds,
);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (url.pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      network: config.network,
      notaryBadge: config.notaryBadge,
    }));
    return;
  }

  if (url.pathname === "/verify" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const { payload, requirements } = JSON.parse(body) as {
        payload: RadixPaymentPayload;
        requirements: RadixPaymentRequirements;
      };

      const currentProposerTimestamp = Math.floor(Date.now() / 1000);
      const currentEpoch = await getCurrentEpoch(config.gatewayBaseUrl);

      const result = await verifyRadixPayment(
        payload, requirements, config, replayStore,
        currentProposerTimestamp, currentEpoch,
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ valid: false, invalidReason: "invalid_exact_radix_deserialization" }));
    }
    return;
  }

  if (url.pathname === "/settle" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const { payload, requirements } = JSON.parse(body) as {
        payload: RadixPaymentPayload;
        requirements: RadixPaymentRequirements;
      };

      const mode = requirements.extra.mode;
      let result;

      if (mode === "sponsored") {
        result = await settleSponsored(
          payload.payload.transaction, requirements, config, gasBudget,
        );
      } else {
        result = await settleNonSponsored(
          payload.payload.transaction, requirements, config,
        );
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, errorReason: "Internal error" }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

const port = parseInt(process.env.PORT ?? "4020");
server.listen(port, () => {
  console.log(`[x402-radix facilitator] listening on :${port}`);
  console.log(`[x402-radix facilitator] network: ${config.network}`);
  console.log(`[x402-radix facilitator] notaryBadge: ${config.notaryBadge}`);
});
