import assert from "node:assert/strict";
import { test } from "node:test";

import { Networks } from "@stellar/stellar-base";

import { connectStellarWallet, signWithWallet, WALLET_PROVIDERS } from "./walletManager.js";

const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const otherAddress = "GA54SPC34JL3I57ENALTO2V26XOFFG4VGQLFQXDGF6KJ5TJY7ODY56ST";

function injectNoir(t, overrides = {}) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      noir: {
        stellar: {
          isNoir: true,
          requestAccess: async () => ({ address }),
          getNetwork: async () => ({ networkPassphrase: Networks.TESTNET }),
          ...overrides,
        },
      },
    },
  });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  });
}

test("Arc exposes Noir and signs through the connected Testnet account", async (t) => {
  assert.ok(WALLET_PROVIDERS.some(({ id, label }) => id === "noir" && label === "Noir"));
  const sign = t.mock.fn(async () => ({ signedTxXdr: "signed-xdr", signerAddress: address }));
  injectNoir(t, { signTransaction: sign });

  const wallet = await connectStellarWallet("noir");
  assert.equal(wallet.address, address);
  assert.equal(wallet.networkPassphrase, Networks.TESTNET);
  assert.equal(await signWithWallet("unsigned-xdr", wallet), "signed-xdr");
  assert.deepEqual(sign.mock.calls[0].arguments, [
    "unsigned-xdr",
    { address, networkPassphrase: Networks.TESTNET },
  ]);
});

test("Noir connection fails when the extension is missing", async () => {
  await assert.rejects(connectStellarWallet("noir"), /Install or enable the Noir/);
});

test("Noir connection rejects an invalid Stellar account", async (t) => {
  injectNoir(t, { requestAccess: async () => ({ address: `${address.slice(0, -1)}A` }) });
  await assert.rejects(connectStellarWallet("noir"), /invalid Stellar account/);
});

test("Noir blocks Mainnet at connect and after a connected wallet changes network", async (t) => {
  let networkPassphrase = Networks.PUBLIC;
  const sign = t.mock.fn();
  injectNoir(t, { getNetwork: async () => ({ networkPassphrase }), signTransaction: sign });
  await assert.rejects(connectStellarWallet("noir"), /Switch Noir to Testnet/);

  networkPassphrase = Networks.TESTNET;
  const wallet = await connectStellarWallet("noir");
  networkPassphrase = Networks.PUBLIC;
  await assert.rejects(signWithWallet("unsigned-xdr", wallet), /Switch Noir to Testnet/);
  assert.equal(sign.mock.callCount(), 0);
});

test("Noir rejects cancelled, wrong-account, and malformed signatures", async (t) => {
  let response = { error: { code: -4, message: "The user rejected this request." } };
  injectNoir(t, { signTransaction: async () => response });
  const wallet = await connectStellarWallet("noir");
  await assert.rejects(signWithWallet("unsigned-xdr", wallet), /user rejected/);

  response = { signedTxXdr: "signed-xdr", signerAddress: otherAddress };
  await assert.rejects(signWithWallet("unsigned-xdr", wallet), /account changed/);

  response = { signedTxXdr: 42, signerAddress: address };
  await assert.rejects(signWithWallet("unsigned-xdr", wallet), /did not return a signed transaction/);
});
