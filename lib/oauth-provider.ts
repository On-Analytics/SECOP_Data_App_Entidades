import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

const AUTH_FILE = join(process.cwd(), ".mcp-auth.json");

interface StoredAuth {
  clientInformation?: OAuthClientInformationFull;
  tokens?: OAuthTokens;
}

function loadStoredAuth(): StoredAuth {
  if (!existsSync(AUTH_FILE)) return {};
  try {
    return JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveStoredAuth(data: StoredAuth) {
  writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * OAuth client provider that persists tokens/client registration to a local
 * gitignored file (.mcp-auth.json). Lets a manually-run script reuse the
 * refresh token across runs instead of forcing a browser login every time.
 * See memory dataapps-transparency-concept.md: the refresh job is run
 * manually for now (WorkOS AuthKit has no headless/M2M path wired up yet).
 */
export class FilePersistedOAuthClientProvider implements OAuthClientProvider {
  private _codeVerifier: string | undefined;
  private store: StoredAuth;

  constructor(
    private _redirectUrl: string,
    private _clientMetadata: OAuthClientProvider["clientMetadata"],
    private onRedirect: (url: URL) => void,
  ) {
    this.store = loadStoredAuth();
  }

  get redirectUrl() {
    return this._redirectUrl;
  }

  get clientMetadata() {
    return this._clientMetadata;
  }

  clientInformation(): OAuthClientInformation | undefined {
    return this.store.clientInformation;
  }

  saveClientInformation(clientInformation: OAuthClientInformationFull) {
    this.store.clientInformation = clientInformation;
    saveStoredAuth(this.store);
  }

  tokens(): OAuthTokens | undefined {
    return this.store.tokens;
  }

  saveTokens(tokens: OAuthTokens) {
    this.store.tokens = tokens;
    saveStoredAuth(this.store);
  }

  redirectToAuthorization(authorizationUrl: URL) {
    this.onRedirect(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string) {
    this._codeVerifier = codeVerifier;
  }

  codeVerifier(): string {
    if (!this._codeVerifier) {
      throw new Error("No code verifier saved");
    }
    return this._codeVerifier;
  }
}
