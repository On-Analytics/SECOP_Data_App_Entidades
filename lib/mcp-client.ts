import { createServer } from "node:http";
import { exec } from "node:child_process";
import { URL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { FilePersistedOAuthClientProvider } from "./oauth-provider.js";

const CALLBACK_PORT = 8090;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;

function openBrowser(url: string) {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      console.log(`\nCould not auto-open the browser. Open this URL manually:\n  ${url}\n`);
    }
  });
}

function waitForOAuthCallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url === "/favicon.ico") {
        res.writeHead(404);
        res.end();
        return;
      }
      const parsedUrl = new URL(req.url || "", "http://localhost");
      const code = parsedUrl.searchParams.get("code");
      const error = parsedUrl.searchParams.get("error");
      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Login successful</h1><p>You can close this tab and return to the terminal.</p></body></html>",
        );
        resolve(code);
        setTimeout(() => server.close(), 3000);
      } else if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<html><body><h1>Login failed</h1><p>${error}</p></body></html>`);
        reject(new Error(`OAuth authorization failed: ${error}`));
      } else {
        res.writeHead(400);
        res.end("Bad request");
        reject(new Error("No authorization code provided"));
      }
    });
    server.listen(CALLBACK_PORT, () => {
      console.log(`Waiting for login at http://localhost:${CALLBACK_PORT} ...`);
    });
  });
}

/**
 * Connects to the SECOP MCP server, running the interactive WorkOS AuthKit
 * login in a browser the first time (and whenever the stored refresh token
 * has expired). Reused token/client registration live in .mcp-auth.json
 * (gitignored) so repeated manual runs of the refresh script don't require
 * logging in every single time.
 */
export async function connectToSecopMcp(serverUrl: string): Promise<Client> {
  const oauthProvider = new FilePersistedOAuthClientProvider(
    CALLBACK_URL,
    {
      client_name: "SECOP Data App - Entidades (refresh job)",
      redirect_uris: [CALLBACK_URL],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
    },
    (authorizationUrl) => {
      console.log(`\nOpening browser to log in with your SECOP Analista account:\n  ${authorizationUrl.toString()}\n`);
      openBrowser(authorizationUrl.toString());
    },
    process.env.MCP_CLIENT_METADATA_URL || undefined,
  );

  const client = new Client({ name: "secop-dataapp-refresh", version: "0.1.0" }, { capabilities: {} });
  const baseUrl = new URL(serverUrl);

  async function attemptConnection(): Promise<void> {
    const transport = new StreamableHTTPClientTransport(baseUrl, { authProvider: oauthProvider });
    try {
      await client.connect(transport);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        const authCode = await waitForOAuthCallback();
        await transport.finishAuth(authCode);
        await attemptConnection();
      } else {
        throw error;
      }
    }
  }

  await attemptConnection();
  return client;
}
