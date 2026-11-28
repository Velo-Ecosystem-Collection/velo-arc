import {
  TESTNET_PASSPHRASE,
  isFreighterConnected,
  getFreighterAddress,
  getFreighterNetwork,
  connectFreighter,
  signFreighterTransaction,
} from "./freighter.js";
import { StrKey } from "@stellar/stellar-base";

/**
 * Unified wallet script for Stellar wallet providers.
 * Freighter and Noir use their browser extension APIs. The remaining entries
 * use Stellar Wallets Kit when it is available.
 */

export const WALLET_PROVIDERS = [
  { id: "freighter", label: "Freighter", type: "extension" },
  { id: "noir", label: "Noir", type: "extension" },
  { id: "xbull", label: "xBull", type: "extension" },
  { id: "albedo", label: "Albedo", type: "web" },
  { id: "lobstr", label: "LOBSTR", type: "web" },
];

const SDK_PACKAGE = "@creit.tech/stellar-wallets-kit";

function requireNoir() {
  const provider = globalThis.window?.noir?.stellar;
  if (provider?.isNoir !== true) {
    throw new Error("Install or enable the Noir browser extension to connect.");
  }
  return provider;
}

function unwrapNoir(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Noir returned an invalid response.");
  }
  if ("error" in response) {
    throw new Error(
      typeof response.error?.message === "string" && response.error.message
        ? response.error.message
        : "Noir could not complete the request.",
    );
  }
  return response;
}

async function requireNoirTestnet(provider) {
  const { networkPassphrase } = unwrapNoir(await provider.getNetwork());
  if (networkPassphrase !== TESTNET_PASSPHRASE) {
    throw new Error("Switch Noir to Testnet, then reconnect.");
  }
}

const normalizeNetwork = (network, passphrase) => {
  if (passphrase === TESTNET_PASSPHRASE) return "testnet";
  const n = String(network || "").toLowerCase();
  if (n.includes("test")) return "testnet";
  if (n.includes("public") || n.includes("main")) return "mainnet";
  return n || "unknown";
};

async function loadWalletSdk() {
  try {
    const mod = await import(/* @vite-ignore */ SDK_PACKAGE);
    return mod?.WalletsKit ? mod : mod?.default || mod;
  } catch (err) {
    throw new Error(
      `Wallet SDK not available (${SDK_PACKAGE}). Install it to enable non-Freighter wallets.`,
    );
  }
}

/**
 * Connect wallet by provider id.
 * Returns a normalized payload that callers can store safely in state.
 */
export async function connectStellarWallet(providerId = "freighter") {
  if (providerId === "noir") {
    const provider = requireNoir();
    const { address } = unwrapNoir(await provider.requestAccess());
    if (typeof address !== "string" || !StrKey.isValidEd25519PublicKey(address)) {
      throw new Error("Noir returned an invalid Stellar account ID.");
    }
    await requireNoirTestnet(provider);
    return {
      providerId,
      address,
      network: "testnet",
      networkPassphrase: TESTNET_PASSPHRASE,
      wrongNetwork: false,
    };
  }

  if (providerId === "freighter") {
    const r = await connectFreighter();
    if (r?.error) throw new Error(r.error);
    return {
      providerId: "freighter",
      address: r?.address || null,
      network: normalizeNetwork(r?.network, r?.networkPassphrase),
      networkPassphrase: r?.networkPassphrase || null,
      wrongNetwork: !!r?.wrongNetwork,
    };
  }

  const sdk = await loadWalletSdk();
  const WalletsKit = sdk?.WalletsKit || sdk?.default?.WalletsKit || sdk?.default;
  if (typeof WalletsKit !== "function") {
    throw new Error("Wallet SDK loaded, but WalletsKit constructor was not found.");
  }

  // Wallets Kit API can vary across versions; this script keeps the integration
  // in one place so we can adapt quickly without touching UI/business code.
  const kit = new WalletsKit({
    network: "TESTNET",
    selectedWalletId: providerId,
  });

  let selected = providerId;
  if (typeof kit.setWallet === "function") {
    await kit.setWallet(providerId);
  } else if (typeof kit.selectWallet === "function") {
    await kit.selectWallet(providerId);
  } else if (kit.wallet?.id) {
    selected = kit.wallet.id;
  }

  let addressResult = null;
  if (typeof kit.getAddress === "function") {
    addressResult = await kit.getAddress();
  } else if (typeof kit.connect === "function") {
    addressResult = await kit.connect();
  }
  const address = addressResult?.address || addressResult?.publicKey || addressResult || null;
  if (!address) {
    throw new Error("Wallet connected, but no public address was returned.");
  }

  const passphrase =
    addressResult?.networkPassphrase ||
    addressResult?.passphrase ||
    TESTNET_PASSPHRASE;
  return {
    providerId: selected,
    address,
    network: normalizeNetwork(addressResult?.network, passphrase),
    networkPassphrase: passphrase,
    wrongNetwork: passphrase !== TESTNET_PASSPHRASE,
    // Keep instance so callers can sign through this provider later.
    client: kit,
  };
}

/**
 * Silent check for pre-connected wallets.
 * Currently implemented for Freighter; other providers usually require explicit user action.
 */
export async function getConnectedWallet() {
  const connected = await isFreighterConnected();
  if (!connected) return null;
  const [addr, net] = await Promise.all([getFreighterAddress(), getFreighterNetwork()]);
  if (!addr?.address) return null;
  return {
    providerId: "freighter",
    address: addr.address,
    network: normalizeNetwork(net?.network, net?.networkPassphrase),
    networkPassphrase: net?.networkPassphrase || null,
    wrongNetwork: net?.networkPassphrase && net.networkPassphrase !== TESTNET_PASSPHRASE,
  };
}

/**
 * Sign XDR using the connected provider.
 * Freighter uses the existing stable path; other providers use Wallet SDK if available.
 */
export async function signWithWallet(assembledXdr, walletState) {
  const providerId = walletState?.providerId || "freighter";
  if (providerId === "freighter") {
    return signFreighterTransaction(assembledXdr, walletState?.address);
  }

  if (providerId === "noir") {
    const { address, networkPassphrase } = walletState;
    if (typeof address !== "string" || !StrKey.isValidEd25519PublicKey(address)) {
      throw new Error("Reconnect Noir before signing.");
    }
    if (networkPassphrase !== TESTNET_PASSPHRASE) {
      throw new Error("Switch Noir to Testnet, then reconnect.");
    }
    const provider = requireNoir();
    await requireNoirTestnet(provider);
    const { signedTxXdr, signerAddress } = unwrapNoir(
      await provider.signTransaction(assembledXdr, { address, networkPassphrase }),
    );
    if (signerAddress !== address) {
      throw new Error("The Noir account changed before signing completed. Reconnect to continue.");
    }
    if (typeof signedTxXdr !== "string" || !signedTxXdr.trim()) {
      throw new Error("Noir did not return a signed transaction.");
    }
    return signedTxXdr;
  }

  const kit = walletState?.client;
  if (!kit) {
    throw new Error("No wallet client found for selected provider.");
  }
  if (typeof kit.signTransaction !== "function") {
    throw new Error("Selected wallet provider does not support signTransaction.");
  }

  const signed = await kit.signTransaction(assembledXdr, {
    networkPassphrase: walletState?.networkPassphrase || TESTNET_PASSPHRASE,
  });
  return signed?.signedTxXdr || signed?.xdr || signed;
}
