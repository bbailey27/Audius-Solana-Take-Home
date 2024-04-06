/**
 * Track uploader and getter
 */

import { access } from "fs";
import {
  establishConnection,
  establishPayer,
  checkProgram,
  uploadTrack,
  getTrack,
  Operation,
  getAccountKey,
  checkAccount,
  createAccount,
  setTrackAccountPubKey,
} from "./track_uploader";
import { PublicKey } from "@solana/web3.js";

async function main() {
  // pull out command line args
  const args = process.argv.slice(2);
  console.log("Arguments:", args);
  const op = args[0] as Operation;
  const id = args[1];
  if (!!op && !!id) {
    // Establish connection to the cluster
    await establishConnection();

    // Determine who pays for the fees
    await establishPayer();

    // Check if the program has been deployed
    await checkProgram();

    // id = seed if this is an upload, for get id = trackpubkey or something instead
    // upload: id = trackPubKey seed
    // get: id = trackPubKey
    let trackAccountPubKey: PublicKey;
    let accountExists = false;
    switch (op) {
      case "upload":
        // get the account id from the cid
        await getAccountKey(id);
        // Check if the account for the requested track exists
        accountExists = await checkAccount();
        if (accountExists) {
          console.log("Track has already been uploaded");
        } else {
          // Create the account to store this track
          await createAccount(id);
          // Upload a track with the given CID
          await uploadTrack(id);
        }
        break;
      case "get":
        trackAccountPubKey = new PublicKey(id);
        setTrackAccountPubKey(trackAccountPubKey);
        accountExists = await checkAccount();
        if (accountExists) {
          // Fetch a track's CID given the track ID
          await getTrack(id);
        } else {
          console.log("No track with that ID exists");
        }
        break;
      default:
        console.log("Please pass a valid operation - 'upload' or 'get'");
    }

    console.log("Success");
  } else {
    console.log(
      "Please pass appropriate arguements - e.g. `npm run start <upload|get> <id>`"
    );
  }
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);
