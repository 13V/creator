#!/usr/bin/env node
/*
 * Prints the fingerprint of a master seed, so an offline backup can be checked
 * against what production is running without either copy being pasted
 * anywhere they could be compared directly.
 *
 * Usage:
 *   ESCROW_MASTER_SEED="..." npm run escrow:fingerprint
 *
 * Then compare with the deployment:
 *   curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<site>/api/admin/escrow
 *
 * Matching `fingerprint` and `treasury` means the backup restores that
 * deployment. Differing values mean it does not, whatever the file is named.
 */
/*
 * Loaded from the test build rather than reimplemented here. The derivation is
 * custody: a second copy of the HKDF that drifted by one label would print a
 * fingerprint that matches nothing, and the whole point of this script is to
 * be trusted when it says a backup is good. `npm run escrow:fingerprint`
 * compiles that build first.
 */
const {
  decodeMasterSeed,
  deriveTreasuryKeypair,
  escrowSeedFingerprint,
} = require("../.test-build/src/lib/escrow/derive.js");

const raw = process.env.ESCROW_MASTER_SEED;
if (!raw) {
  console.error("ESCROW_MASTER_SEED is not set.");
  console.error("Run as: ESCROW_MASTER_SEED='<seed>' npm run escrow:fingerprint");
  process.exit(1);
}

const seed = decodeMasterSeed(raw);

console.log("fingerprint :", escrowSeedFingerprint(seed));
console.log("treasury    :", deriveTreasuryKeypair(seed).publicKey.toBase58());
console.log("seed bytes  :", seed.length);
if (raw !== raw.trim()) {
  console.log();
  console.log("WARNING: this value has surrounding whitespace. It is trimmed");
  console.log("before use, but store it without — an untrimmed copy pasted");
  console.log("into an older build decodes to different bytes entirely.");
}
