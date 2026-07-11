import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import { serve } from "inngest/node";

import { imageWorkerInngest } from "@/services/image-worker/client";
import { functions } from "@/services/image-worker/functions";

export function createImageWorkerServer(): Server {
  const inngestHandler = serve({
    client: imageWorkerInngest,
    functions,
    servePath: "/api/inngest",
  });

  return createServer((request, response) => {
    const pathname = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    ).pathname;

    if (pathname === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ ok: true, service: "meeting-image-worker" }),
      );
      return;
    }

    if (pathname === "/api/inngest") {
      inngestHandler(request, response);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
}

const entrypointUrl = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (entrypointUrl === import.meta.url) {
  const port = Number.parseInt(process.env.PORT ?? "3001", 10);

  createImageWorkerServer().listen(port, "0.0.0.0", () => {
    console.log(`Meeting image worker listening on port ${port}`);
  });
}
