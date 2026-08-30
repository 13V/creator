import "server-only";

import { Connection } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";

import { env } from "../env";

let connection: Connection | null = null;
let online: OnlinePumpSdk | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(env().SOLANA_RPC_URL, "confirmed");
  }
  return connection;
}

export function getOnlineSdk(): OnlinePumpSdk {
  if (!online) {
    online = new OnlinePumpSdk(getConnection());
  }
  return online;
}
