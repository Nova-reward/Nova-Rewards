// Tests for POST /api/merchants/register
// Covers: 201 on success with api_key, 400 on missing fields, 400 on bad wallet

const http = require("http");
const express = require("express");
const { Keypair } = require("stellar-sdk");

// mock the db and stellar modules so we don't need a real DB or network
jest.mock("../db/index", () => ({
  query: jest.fn(),
}));

jest.mock("../../blockchain/stellarService", () => {
  const { StrKey } = require("stellar-sdk");
  return {
    isValidStellarAddress: jest.fn((addr) => {
      if (typeof addr !== "string") return false;
      try {
        return StrKey.isValidEd25519PublicKey(addr);
      } catch {
        return false;
      }
    }),
  };
});

const { query } = require("../db/index");

// spin up a lightweight express app with just the merchants route,
// so we don't pull in server.js and trigger validateEnv on startup
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/merchants", require("../routes/merchants"));
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || "internal_error",
      message: err.message || "An unexpected error occurred",
    });
  });
  return app;
}

// helper to POST JSON and get { status, body } back,
// using the built-in http module so no extra deps are needed
function post(server, path, payload) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const { port } = server.address();

    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () =>
          resolve({ status: res.statusCode, body: JSON.parse(raw) }),
        );
      },
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

describe("POST /api/merchants/register", () => {
  let server;

  beforeAll(
    () =>
      new Promise((resolve) => {
        server = http.createServer(buildApp()).listen(0, "127.0.0.1", resolve);
      }),
  );

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // happy path — should get back a 201 with the new merchant record and api_key

  test("201 – valid body returns merchant record with a generated api_key", async () => {
    const wallet = Keypair.random().publicKey();
    const fakeRow = {
      id: 1,
      name: "ACME Corp",
      wallet_address: wallet,
      business_category: "Retail",
      api_key: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
      created_at: new Date().toISOString(),
    };
    query.mockResolvedValueOnce({ rows: [fakeRow] });

    const { status, body } = await post(server, "/api/merchants/register", {
      name: "ACME Corp",
      walletAddress: wallet,
      businessCategory: "Retail",
    });

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(typeof body.data.api_key).toBe("string");
    expect(body.data.api_key.length).toBeGreaterThan(0);
    // make sure the DB was actually hit with the right wallet
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1][1]).toBe(wallet);
  });

  test("201 – businessCategory is optional; null is stored when omitted", async () => {
    const wallet = Keypair.random().publicKey();
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          name: "Solo Dev",
          wallet_address: wallet,
          business_category: null,
          api_key: "deadbeefdeadbeefdeadbeefdeadbeef",
          created_at: new Date().toISOString(),
        },
      ],
    });

    const { status, body } = await post(server, "/api/merchants/register", {
      name: "Solo Dev",
      walletAddress: wallet,
    });

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    // third param in the INSERT should be null when businessCategory is not sent
    expect(query.mock.calls[0][1][2]).toBeNull();
  });

  // missing required fields — should bail out before touching the DB

  test("400 – missing name field", async () => {
    const { status, body } = await post(server, "/api/merchants/register", {
      walletAddress: Keypair.random().publicKey(),
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(body.message).toMatch(/name/i);
    expect(query).not.toHaveBeenCalled();
  });

  test("400 – name is an empty / whitespace-only string", async () => {
    const { status, body } = await post(server, "/api/merchants/register", {
      name: "   ",
      walletAddress: Keypair.random().publicKey(),
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(query).not.toHaveBeenCalled();
  });

  test("400 – missing walletAddress field", async () => {
    const { status, body } = await post(server, "/api/merchants/register", {
      name: "ACME Corp",
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(query).not.toHaveBeenCalled();
  });

  test("400 – empty request body", async () => {
    const { status, body } = await post(server, "/api/merchants/register", {});

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(query).not.toHaveBeenCalled();
  });

  // invalid wallet address — the route validates it's a real Ed25519 public key

  test("400 – walletAddress is an arbitrary string", async () => {
    const { status, body } = await post(server, "/api/merchants/register", {
      name: "ACME Corp",
      walletAddress: "not-a-stellar-address",
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(body.message).toMatch(/wallet/i);
    expect(query).not.toHaveBeenCalled();
  });

  test("400 – walletAddress is an empty string", async () => {
    const { status, body } = await post(server, "/api/merchants/register", {
      name: "ACME Corp",
      walletAddress: "",
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(query).not.toHaveBeenCalled();
  });

  test("400 – walletAddress is a secret key (S-prefix) instead of a public key", async () => {
    const secretKey = Keypair.random().secret();
    const { status, body } = await post(server, "/api/merchants/register", {
      name: "ACME Corp",
      walletAddress: secretKey,
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(query).not.toHaveBeenCalled();
  });

  test("400 – invalid wallet address format", async () => {
    const { status, body } = await post(server, "/api/merchants/register", {
      name: "ACME Corp",
      walletAddress: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN_INVALID",
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(query).not.toHaveBeenCalled();
  });

  test("201 – valid body with all fields returns merchant record with api_key", async () => {
    const wallet = Keypair.random().publicKey();
    const fakeRow = {
      id: 1,
      name: "ACME Corp",
      wallet_address: wallet,
      business_category: "Retail",
      api_key: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
      created_at: new Date().toISOString(),
    };
    query.mockResolvedValueOnce({ rows: [fakeRow] });

    const { status, body } = await post(server, "/api/merchants/register", {
      name: "ACME Corp",
      walletAddress: wallet,
      businessCategory: "Retail",
    });

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.api_key).toBeDefined();
    expect(typeof body.data.api_key).toBe("string");
    expect(body.data.api_key.length).toBeGreaterThan(0);
  });

  test("201 – api_key is generated and returned", async () => {
    const wallet = Keypair.random().publicKey();
    const fakeRow = {
      id: 1,
      name: "Test Merchant",
      wallet_address: wallet,
      business_category: null,
      api_key: "generatedapikey1234567890abcdef",
      created_at: new Date().toISOString(),
    };
    query.mockResolvedValueOnce({ rows: [fakeRow] });

    const { status, body } = await post(server, "/api/merchants/register", {
      name: "Test Merchant",
      walletAddress: wallet,
    });

    expect(status).toBe(201);
    expect(body.data.api_key).toBe("generatedapikey1234567890abcdef");
  });

  test("400 – name is not a string", async () => {
    const { status, body } = await post(server, "/api/merchants/register", {
      name: 123,
      walletAddress: Keypair.random().publicKey(),
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(query).not.toHaveBeenCalled();
  });

  test("400 – walletAddress is null", async () => {
    const { status, body } = await post(server, "/api/merchants/register", {
      name: "ACME Corp",
      walletAddress: null,
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(query).not.toHaveBeenCalled();
  });
});
