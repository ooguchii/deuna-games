import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  spawn,
  spawnSync,
} from "node:child_process";
import {
  setTimeout as delay,
} from "node:timers/promises";

const secureOrigin = "https://127.0.0.1:3443";
const upstreamOrigin = "http://127.0.0.1:3000";
const oldPid = Number(process.env.DEUNA_VISUAL_APP_PID ?? "0");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} falló: ${result.stderr || result.stdout}`
    );
  }

  return result.stdout;
}

async function waitForHttp(url, insecure = false) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const args = ["--fail", "--silent", "--show-error"];
    if (insecure) args.push("--insecure");
    args.push(url);
    const result = spawnSync("curl", args, { stdio: "ignore" });
    if (result.status === 0) return;
    await delay(150);
  }

  throw new Error(`El runtime visual no quedó disponible en ${url}.`);
}

if (oldPid > 0) {
  try {
    process.kill(oldPid, "SIGTERM");
  } catch {
    // El step anterior puede haber terminado por su cuenta.
  }
  await delay(250);
}

const tlsDir = await mkdtemp(path.join(os.tmpdir(), "deuna-visual-tls-"));
const caKey = path.join(tlsDir, "ca.key");
const caCert = path.join(tlsDir, "ca.crt");
const serverKey = path.join(tlsDir, "server.key");
const serverCsr = path.join(tlsDir, "server.csr");
const serverCert = path.join(tlsDir, "server.crt");
const extensions = path.join(tlsDir, "server.ext");
const installedCa = "/usr/local/share/ca-certificates/deuna-visual-ci.crt";

let app = null;
let proxy = null;

try {
  run("openssl", [
    "req", "-x509", "-new", "-nodes", "-newkey", "rsa:2048",
    "-keyout", caKey,
    "-out", caCert,
    "-days", "1",
    "-subj", "/CN=DeUna Visual CI CA",
    "-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
  ]);
  run("openssl", [
    "req", "-new", "-nodes", "-newkey", "rsa:2048",
    "-keyout", serverKey,
    "-out", serverCsr,
    "-subj", "/CN=127.0.0.1",
  ]);
  await writeFile(
    extensions,
    [
      "subjectAltName=IP:127.0.0.1,DNS:localhost",
      "basicConstraints=critical,CA:FALSE",
      "keyUsage=critical,digitalSignature,keyEncipherment",
      "extendedKeyUsage=serverAuth",
      "",
    ].join("\n"),
    "utf8"
  );
  run("openssl", [
    "x509", "-req",
    "-in", serverCsr,
    "-CA", caCert,
    "-CAkey", caKey,
    "-CAcreateserial",
    "-out", serverCert,
    "-days", "1",
    "-sha256",
    "-extfile", extensions,
  ]);

  run("sudo", ["cp", caCert, installedCa]);
  run("sudo", ["update-ca-certificates"]);

  const appEnv = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: secureOrigin,
    DEUNA_ADMIN_ORIGIN: secureOrigin,
  };
  app = spawn(
    process.execPath,
    ["./tools/run-next.mjs", "start", "--hostname", "127.0.0.1", "--port", "3000"],
    {
      env: appEnv,
      stdio: ["ignore", "inherit", "inherit"],
    }
  );
  await waitForHttp(`${upstreamOrigin}/`);

  proxy = spawn(
    process.execPath,
    ["./tools/visual-https-proxy.mjs"],
    {
      env: {
        ...appEnv,
        DEUNA_VISUAL_TLS_KEY: serverKey,
        DEUNA_VISUAL_TLS_CERT: serverCert,
      },
      stdio: ["ignore", "inherit", "inherit"],
    }
  );
  await waitForHttp(`${secureOrigin}/`, true);

  process.env.DEUNA_VISUAL_BASE_URL = secureOrigin;
  process.env.NEXT_PUBLIC_SITE_URL = secureOrigin;
  process.env.DEUNA_ADMIN_ORIGIN = secureOrigin;
  process.env.NODE_ENV = "production";

  await import("./visual-smoke.mjs");
} finally {
  proxy?.kill("SIGTERM");
  app?.kill("SIGTERM");
  run("sudo", ["rm", "-f", installedCa]);
  run("sudo", ["update-ca-certificates"]);
  await rm(tlsDir, { recursive: true, force: true }).catch(() => {});
}
