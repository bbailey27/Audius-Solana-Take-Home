# Audius-Solana-Take-Home

# Track Uploader on Solana

Used [Solana Hello World Example Project](https://github.com/solana-labs/example-helloworld) as starter code / inspiration as this is my first time working with Solana or Rust

The project includes:

* An on-chain track uploader program
* A client that can upload new tracks (as IPFS CIDs) to an account and retrieve the CID by the new track ID

## Prerequisites

Set up IPFS: https://docs.ipfs.io/install/command-line/#official-distributions
Upload a file to receive a content ID:
```
ipfs daemon
ipfs add <path-to-file>
```

You may need to switch to Node v16:
```
nvm install 16 && nvm use 16
```

## Quick Start

Start a local Solana cluster in one terminal window:
```bash
solana-test-validator
```

Watch solana logs in another terminal window:
```bash
solana logs
```

Build and deploy the on-chain program:
```bash
npm run build
npm run deploy
```

### Run the client to load and interact with the on-chain program:

To 'upload' a track via its IPFS CID:
```bash
npm run start -- upload <CID>
```
To get a cid from a trackID (printed during upload)
```bash
npm run start -- get <trackID>
```