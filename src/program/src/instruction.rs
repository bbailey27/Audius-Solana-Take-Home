use borsh::BorshDeserialize;
use solana_program::{
    msg,
    program_error::ProgramError,
};

#[derive(Debug)]
pub enum TrackInstruction {
    UploadTrack { cid: String },
    GetTrack { id: String },
}

#[derive(BorshDeserialize, Debug)]
struct TrackInstructionPayload {
    variant: u8,
    id: String
}

impl TrackInstruction {
    /// Unpack inbound buffer to associated Instruction
    /// The expected format for input is a Borsh serialized vector
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let payload = TrackInstructionPayload::try_from_slice(input).unwrap();
        msg!("Payload: {:?}", payload);
        match payload.variant {
            0 => Ok(Self::UploadTrack {
                cid: payload.id,
            }),
            4 => Ok(Self::GetTrack {
                id: payload.id,
            }),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}
