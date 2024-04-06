use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};
pub mod instruction;
use instruction::TrackInstruction;

/// Define the type of state stored in accounts
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct TrackAccount {
    // IPFS Content ID
    pub cid: String,
}

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
pub fn process_instruction(
    program_id: &Pubkey, // Public key of the account the hello world program was loaded into
    accounts: &[AccountInfo], // The account to say hello to
    instruction_data: &[u8], // instruction and id
) -> ProgramResult {
    msg!("Track Uploader Rust program entrypoint - 5:53");

    // Call unpack to deserialize instruction_data
    let instruction = TrackInstruction::unpack(instruction_data)?;
    msg!("unpacked: {:?}", instruction);

    // Iterating accounts is safer than indexing
    let accounts_iter = &mut accounts.iter();

    // Get the account to say hello to
    let account = next_account_info(accounts_iter)?;

    // The account must be owned by the program in order to modify its data
    if account.owner != program_id {
        msg!("Referenced account does not have the correct program id");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Match the returned data struct to what you expect
    match instruction {
        TrackInstruction::UploadTrack { cid } => {
            // Execute program code to create a track
            msg!("Uploading: {}", cid);
            let result = upload_track(account, cid);
            match result {
                Ok(value) => {
                    // Handle success case
                    println!("Result: {:?}", value);
                }
                Err(error) => {
                    // Handle error case
                    println!("Error: {:?}", error);
                }
            }
        },
        TrackInstruction::GetTrack { id } => {
            msg!("Getting: {}", id);
            // Execute program code to get a track
            // Actually this might just be client, but good to have a placeholder for future operations
        },
    }
    Ok(())
}


pub fn upload_track(
    account: &AccountInfo,
    cid: String
) -> ProgramResult {
    let mut track_account = TrackAccount::try_from_slice(&account.data.borrow())?;
    msg!("track account: {:?}", track_account);
    track_account.cid = cid;
    track_account.serialize(&mut &mut account.data.borrow_mut()[..])?;
    msg!("Saved CID: {}", track_account.cid);
    Ok(())
}

// // Sanity tests
// #[cfg(test)]
// mod test {
//     use super::*;
//     use solana_program::clock::Epoch;
//     use std::mem;

//     #[test]
//     fn test_sanity() {
//         let program_id = Pubkey::default();
//         let key = Pubkey::default();
//         let mut lamports = 0;
//         let mut data = vec![0; mem::size_of::<u32>()];
//         let owner = Pubkey::default();
//         let account = AccountInfo::new(
//             &key,
//             false,
//             true,
//             &mut lamports,
//             &mut data,
//             &owner,
//             false,
//             Epoch::default(),
//         );
//         let instruction_data: Vec<u8> = Vec::new();

//         let accounts = vec![account];

//         assert_eq!(
//             GreetingAccount::try_from_slice(&accounts[0].data.borrow())
//                 .unwrap()
//                 .counter,
//             0
//         );
//         process_instruction(&program_id, &accounts, &instruction_data).unwrap();
//         assert_eq!(
//             GreetingAccount::try_from_slice(&accounts[0].data.borrow())
//                 .unwrap()
//                 .counter,
//             1
//         );
//         process_instruction(&program_id, &accounts, &instruction_data).unwrap();
//         assert_eq!(
//             GreetingAccount::try_from_slice(&accounts[0].data.borrow())
//                 .unwrap()
//                 .counter,
//             2
//         );
//     }
// }