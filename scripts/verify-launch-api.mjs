/**
 * Drives a real launch through the app's own HTTP API.
 *
 * `verify:launch` exercises the pump SDK directly; this exercises *our*
 * routes — request parsing, profile resolution, metadata upload, escrow
 * derivation, the deferred-buy split and the confirm/index step. A launch can
 * be perfectly correct at the SDK layer and still be broken at the route
 * layer, which is the layer a person actually touches.
 *
 *   npm run local:validator                        # terminal one
 *   ESCROW_MASTER_SEED=anything \                  # terminal two
 *     SOLANA_RPC_URL=http://127.0.0.1:8899 npm start -- -p 3111
 *   npm run verify:launch-api                      # terminal three
 *
 * Never point APP at production: every case here mints a real coin.
 */
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";

const APP = process.env.APP ?? "http://127.0.0.1:3111";
const RPC = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
const connection = new Connection(RPC, "confirmed");

let failures = 0;
function check(label, condition, detail = "") {
  console.log(`  ${condition ? "ok   " : "FAIL "} ${label}${detail ? `  (${detail})` : ""}`);
  if (!condition) failures++;
}

async function fund(pubkey, sol) {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  const bh = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
}

async function post(path, body) {
  const res = await fetch(APP + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: res.status, json };
}

async function run({ label, handle, platform, devBuySol }) {
  console.log(`\n=== ${label} ===`);

  const payer = Keypair.generate();
  await fund(payer.publicKey, 30);

  // 1. Prepare — our route resolves the profile, uploads metadata, derives the
  //    escrow and builds the transaction.
  const prep = await post("/api/launch/prepare", {
    platform,
    handle,
    payer: payer.publicKey.toBase58(),
    name: `${handle} coin`,
    symbol: "E2E" + Math.floor(Math.random() * 900 + 100),
    description: "end-to-end launch check",
    imageUrl: "https://pbs.twimg.com/profile_images/1.png",
    devBuySol,
  });

  if (prep.status !== 200) {
    check("prepare returned 200", false, `${prep.status} ${JSON.stringify(prep.json).slice(0, 220)}`);
    return;
  }
  const p = prep.json;
  check("prepare returned 200", true);
  check("carries a transaction", typeof p.transaction === "string" && p.transaction.length > 0);
  check("carries a mint", typeof p.mint === "string");
  check("carries an escrow", typeof p.escrowPubkey === "string", `${p.escrowKind} ${p.escrowPubkey}`);
  check("metadata uri is a url", /^https?:\/\//.test(p.metadataUri ?? ""), p.metadataUri);

  // 2. Sign and send exactly what the browser would have signed.
  const tx = VersionedTransaction.deserialize(Buffer.from(p.transaction, "base64"));
  const size = tx.serialize().length;
  check("transaction is under the packet limit", size <= 1232, `${size} bytes`);
  tx.sign([payer]);

  let signature;
  try {
    signature = await connection.sendTransaction(tx, { skipPreflight: false });
    await connection.confirmTransaction(
      { signature, blockhash: p.blockhash, lastValidBlockHeight: p.lastValidBlockHeight },
      "confirmed",
    );
    check("launch transaction confirmed", true, signature.slice(0, 16) + "…");
  } catch (error) {
    check("launch transaction confirmed", false, String(error).slice(0, 300));
    return;
  }

  // 3. The coin has to actually exist on chain.
  const mintInfo = await connection.getAccountInfo(new PublicKey(p.mint));
  check("mint account exists on chain", mintInfo !== null);

  // 4. Confirm — our route indexes it and applies the fee split.
  const conf = await post("/api/launch/confirm", {
    signature,
    mint: p.mint,
    platform,
    handle,
    name: `${handle} coin`,
    symbol: "E2E",
    description: "end-to-end launch check",
    metadataUri: p.metadataUri,
    imageUrl: p.imageUri ?? undefined,
    launcher: payer.publicKey.toBase58(),
    devBuyLamports: Math.round(devBuySol * LAMPORTS_PER_SOL),
  });
  check(
    "confirm returned 200",
    conf.status === 200,
    conf.status === 200 ? "" : `${conf.status} ${JSON.stringify(conf.json).slice(0, 260)}`,
  );
  if (conf.status === 200) {
    // The two halves of confirm fail independently on purpose: the fee split
    // is on-chain and one-shot, indexing is cosmetic and retryable.
    check("fee split applied on chain", conf.json.feeShare?.applied === true,
      conf.json.feeShare?.reason ?? "");
    console.log(`  info  indexed=${conf.json.indexed}`);
  }

  if (p.deferredBuyLamports > 0) {
    console.log(`  note  opening buy deferred: ${p.deferredBuyLamports / LAMPORTS_PER_SOL} SOL`);
  }
}

await run({ label: "launch with no opening buy", platform: "x", handle: "mrbeast", devBuySol: 0 });
await run({ label: "launch with a 1 SOL opening buy", platform: "x", handle: "naval", devBuySol: 1 });
await run({ label: "launch for a reddit handle", platform: "reddit", handle: "spez", devBuySol: 0 });

console.log(failures === 0 ? "\nPASS: the launch API works end to end" : `\nFAIL: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
