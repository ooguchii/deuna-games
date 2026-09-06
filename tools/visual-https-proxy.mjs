import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import process from "node:process";

const keyPath = process.env.DEUNA_VISUAL_TLS_KEY;
const certPath = process.env.DEUNA_VISUAL_TLS_CERT;
const listenHost = process.env.DEUNA_VISUAL_PROXY_HOST ?? "127.0.0.1";
const listenPort = Number(process.env.DEUNA_VISUAL_PROXY_PORT ?? "3443");
const upstreamHost = process.env.DEUNA_VISUAL_UPSTREAM_HOST ?? "127.0.0.1";
const upstreamPort = Number(process.env.DEUNA_VISUAL_UPSTREAM_PORT ?? "3000");

if (!keyPath || !certPath) {
  throw new Error("Faltan DEUNA_VISUAL_TLS_KEY/DEUNA_VISUAL_TLS_CERT para el proxy HTTPS visual.");
}

if (!Number.isInteger(listenPort) || !Number.isInteger(upstreamPort)) {
  throw new Error("Los puertos del proxy visual deben ser enteros.");
}

const server = https.createServer(
  {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  },
  (request, response) => {
    const forwardedHeaders = {
      ...request.headers,
      host: request.headers.host ?? `${listenHost}:${listenPort}`,
      "x-forwarded-host": request.headers.host ?? `${listenHost}:${listenPort}`,
      "x-forwarded-proto": "https",
    };

    const upstream = http.request(
      {
        hostname: upstreamHost,
        port: upstreamPort,
        method: request.method,
        path: request.url,
        headers: forwardedHeaders,
      },
      (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          upstreamResponse.statusMessage,
          upstreamResponse.headers
        );
        upstreamResponse.pipe(response);
      }
    );

    upstream.on("error", (error) => {
      if (!response.headersSent) {
        response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      response.end(`Proxy HTTPS visual: ${error.message}`);
    });

    request.pipe(upstream);
  }
);

server.on("clientError", (_error, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(listenPort, listenHost, () => {
  console.log(
    `Proxy HTTPS visual activo en https://${listenHost}:${listenPort} -> http://${upstreamHost}:${upstreamPort}`
  );
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
