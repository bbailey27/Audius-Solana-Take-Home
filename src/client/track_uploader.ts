/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
    Keypair,
    Connection,
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
    TransactionInstruction,
    Transaction,
    sendAndConfirmTransaction,
  } from '@solana/web3.js';
  import fs from 'mz/fs';
  import path from 'path';
  // import * as borsh from '@coral-xyz/borsh'
  import * as borsh from 'borsh';
  import * as BufferLayout from '@solana/buffer-layout';
  import { Buffer } from 'buffer';

  import {getPayer, getRpcUrl, createKeypairFromFile} from './utils';

  export type Operation = 'upload' | 'get';
  
  /**
   * Connection to the network
   */
  let connection: Connection;
  
  /**
   * Keypair associated to the fees' payer
   */
  let payer: Keypair;
  
  /**
   * Hello world's program id
   */
  let programId: PublicKey;
  
  /**
   * The public key of the account where we will store the track data
   */
  let trackAccountPubKey: PublicKey;
  export function setTrackAccountPubKey(key: PublicKey) {
    trackAccountPubKey = key;
  }
  
  /**
   * Path to program files
   */
  const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');
  
  /**
   * Path to program shared object file which should be deployed on chain.
   * This file is created when running `npm run build:program`
   */
  const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'trackuploader.so');
  
  /**
   * Path to the keypair of the deployed program.
   * This file is created when running `solana program deploy dist/program/trackuploader.so`
   */
  const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'trackuploader-keypair.json');
  
  /**
   * The state of a track data account managed by the track uploader program
   */
  class TrackAccount {
    cid = '';
    constructor(fields: {cid: string} | undefined = undefined) {
      if (fields) {
        this.cid = fields.cid;
      }
    }

    // borshAccountSchema = borsh.struct([
    //   borsh.str('cid'),
    // ])
//TODO was converting this to the deserialize example if I go back to this library

  }
  
  /**
   * Borsh schema definition for track accounts
   */
  const TrackAccountSchema = new Map([
    [TrackAccount, {
      kind: 'struct',
      fields: [
        ['cid', 'string']
      ]
    }],
  ]);
  

  const enum TrackInstructionVariant {
    Upload = 0,
    Get = 1,
  }

  /**
   * An instruction for uploading a track
   */
    class TrackInstruction {
      variant: TrackInstructionVariant = TrackInstructionVariant.Get;
      id: string = '';
      constructor(fields: {variant: TrackInstructionVariant, id: string} | undefined = undefined) {
        // super();
        if (fields) {
          this.variant = fields.variant;
          this.id = fields.id;
        }
      }
      // borshInstructionSchema = borsh.struct([
      //   borsh.u8('variant'),
      //   borsh.str('id'),
      // ])
  
      // serialize(): Buffer {
      //   const buffer = Buffer.alloc(1000)
      //   this.borshInstructionSchema.encode(this, buffer)
      //   return buffer.slice(0, this.borshInstructionSchema.getSpan(buffer))
      // }
    }

  /**
   * Borsh schema definition for instruction data
   */
    const TrackInstructionSchema = new Map([
      [TrackInstruction, {
        kind: 'struct',
        fields: [
          ['variant', 'u8'],
          ['id', 'string']
        ]
      }],
    ]);
  
  /**
   * The expected size of each track account.
   */
  const TRACK_ACCOUNT_SIZE = borsh.serialize(
    TrackAccountSchema,
    new TrackAccount({cid: 'QmYSD7cRksPGU4GnqW8WRuoTYwPkqDsFNEd4fSaEw7oYu3'}),
  ).length;
  
  /**
   * Establish a connection to the cluster
   */
  export async function establishConnection(): Promise<void> {
    const rpcUrl = await getRpcUrl();
    connection = new Connection(rpcUrl, 'confirmed');
    const version = await connection.getVersion();
    console.log('ESTABLISH CONNECTION: Connection to cluster established:', rpcUrl, version);
  }
  
  /**
   * Establish an account to pay for everything
   */
  export async function establishPayer(): Promise<void> {
    let fees = 0;
    if (!payer) {
      const {feeCalculator} = await connection.getRecentBlockhash();
  
      // Calculate the cost to fund the greeter account
      fees += await connection.getMinimumBalanceForRentExemption(TRACK_ACCOUNT_SIZE);
  
      // Calculate the cost of sending transactions
      fees += feeCalculator.lamportsPerSignature * 100; // wag
  
      payer = await getPayer();
    }
  
    let lamports = await connection.getBalance(payer.publicKey);
    if (lamports < fees) {
      // If current balance is not enough to pay for fees, request an airdrop
      const sig = await connection.requestAirdrop(
        payer.publicKey,
        fees - lamports,
      );
      await connection.confirmTransaction(sig);
      lamports = await connection.getBalance(payer.publicKey);
    }
  
    console.log(
      'ESTABLISH PAYER: Using account',
      payer.publicKey.toBase58(),
      'containing',
      lamports / LAMPORTS_PER_SOL,
      'SOL to pay for fees',
    );
  }
  
  /**
   * Check if the track uploader BPF program has been deployed
   */
  export async function checkProgram(): Promise<void> {
    // Read program id from keypair file
    try {
      const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
      programId = programKeypair.publicKey;
    } catch (err) {
      const errMsg = (err as Error).message;
      throw new Error(
        `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/trackuploader.so\``,
      );
    }
  
    // Check if the program has been deployed
    const programInfo = await connection.getAccountInfo(programId);
    if (programInfo === null) {
      if (fs.existsSync(PROGRAM_SO_PATH)) {
        throw new Error(
          'Program needs to be deployed with `solana program deploy dist/program/trackuploader.so`',
        );
      } else {
        throw new Error('Program needs to be built and deployed');
      }
    } else if (!programInfo.executable) {
      throw new Error(`Program is not executable`);
    }
    console.log(`CHECK PROGRAM: Using program ${programId.toBase58()}`);
  }

  /**
   * Use the CID as a seed to determine the pubKey for the account that would hold the associated track data
   */
  export async function getAccountKey(id: string): Promise<void> {
    // Derive the address (public key) of a track account from the program and track cid so that it's easy to find later.
    trackAccountPubKey = await PublicKey.createWithSeed(
      payer.publicKey,
      id,
      programId,
    );
    console.log('GET ACCOUNT KEY', trackAccountPubKey.toBase58());
  }
  /**
   * Check if the account associated with this CID exists
   */
  export async function checkAccount(): Promise<boolean> {
        // Check if the track account has already been created
        const trackAccount = await connection.getAccountInfo(trackAccountPubKey);
        console.log('CHECK ACCOUNT: Does account',
          trackAccountPubKey.toBase58(),
          'exist?',
          !!trackAccount,
          );
        return !!trackAccount
  }

  /**
   * Create an account with the given seed and key
   */
  export async function createAccount(id: string): Promise<void> {
    console.log(
      'CREATE ACCOUNT: Creating account',
      trackAccountPubKey.toBase58(),
      'to upload the cid to',
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      TRACK_ACCOUNT_SIZE,
    );
    // Get the recent blockhash
    const latestBlockhash = await connection.getLatestBlockhash();

    // Create a new transaction
    const transaction = new Transaction();

    // Set the recent blockhash and fee payer
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = payer.publicKey;
    transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;

    // Add the instruction to create the account
    transaction.add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        newAccountPubkey: trackAccountPubKey,
        seed: id,
        lamports,
        space: TRACK_ACCOUNT_SIZE,
        programId,
      })
    );
    // console.log('SIGNATURES before', transaction.signatures)

    // Sign the transaction with the payer's private key
    transaction.sign(payer);
    // console.log('SIGNATURES after', transaction.signatures)
    
    // Note logging the instruction itself isn't the most useful but it does include the 3 keys and the data includes the seed id
    
    // console.log('\n=========\nTRANSACTION\n',transaction, '\n=========\n');
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }


  
  /**
   * Upload a track with the given IPFS Contend ID and print the new associated track ID (pubKey of the account)
   */
  export async function uploadTrack(cid: string): Promise<void> {
    console.log('UPLOAD TRACK: Uploading track', cid, 'to', trackAccountPubKey.toBase58());
    const instruction = new TransactionInstruction({
      keys: [{pubkey: trackAccountPubKey, isSigner: false, isWritable: true}],
      programId,
      data: createTrackInstructionData(TrackInstructionVariant.Upload, cid),
      // data: Buffer.from(borsh.serialize(TrackInstructionDataSchema, new TrackInstruction({variant: TrackInstructionVariant.Upload, id: cid}))),
    });
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(instruction),
      [payer],
    );
    console.log(`New Track ID for CID ${cid}: ${trackAccountPubKey}`);
  }

  //new TrackInstruction({variant: TrackInstructionVariant.Upload, id: cid}).serialize()
  function createTrackInstructionData(variant: TrackInstructionVariant, id: string): Buffer {
    console.log('CREATE TRACK INSTRUCTION DATA')
    const instructionData = new TrackInstruction({variant, id});
    console.log('instruction data', instructionData);
    const dataSerBuf = Buffer.from(borsh.serialize(TrackInstructionSchema, instructionData));
    console.log('buf', dataSerBuf);
    console.log('deserialized', borsh.deserialize(TrackInstructionSchema, TrackInstruction, dataSerBuf))
    return dataSerBuf;
    // const idBuffer = Buffer.from(id, 'utf-8');
    // const dataLayout = BufferLayout.struct<TrackInstruction>([
    //   BufferLayout.u8('variant'),
    //   BufferLayout.blob(32,'id'),
    //   // BufferLayout.struct([BufferLayout.u8('id').span(id.length)], 'id'), // Represents the length of the id followed by the id itself
    // ]);
  
    // //todo may need this for more data https://solana.stackexchange.com/questions/1522/how-to-encode-array-data-uint8array-for-instruction
  
    // const data = Buffer.alloc(dataLayout.span);
    // const instruction = new TrackInstruction({ variant, id: idBuffer });
    // dataLayout.encode(instruction, data);
  
    // return data;
  }
  
  /**
   * Get the CID for the requested track
   */
  export async function getTrack(trackId: string): Promise<void> {
    console.log('GET TRACK', trackId);
    const accountInfo = await connection.getAccountInfo(trackAccountPubKey);
    if (accountInfo === null) {
      throw 'Error: cannot find the track account';
    }
    const track = borsh.deserialize(
      TrackAccountSchema,
      TrackAccount,
      accountInfo.data,
    );
    console.log(
      'Fetched track with ID',
      trackId,
      'and it has CID',
      track.cid
    );
  }//TODO this might need to be a full instruction. if not, maybe remove 'upload' from above call