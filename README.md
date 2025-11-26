# Honest

Honest is a confidential business card exchange platform built on Zama FHEVM. It leverages fully homomorphic encryption to protect your contact information, ensuring that sensitive data is only revealed when both parties mutually agree to exchange. This allows both parties to better understand each other before important transactions begin.

## Overview

Traditional business card exchanges pose privacy risks—once shared, you lose control. Honest changes this paradigm by encrypting your sensitive information on-chain and only decrypting it after a mutual two-way exchange is confirmed.

## Key Features

- **Mutual consent exchange** - Both parties' encrypted info is only accessible when BOTH parties agree
- **Selective privacy** - Public info (surname) for identification, encrypted info (phone, social, location) for privacy
- **On-chain encryption** - All sensitive data stored as FHE ciphertexts (euint8/64/128/256)
- **Permanent connections** - Once exchanged, contacts can always view each other's updated info
- **No intermediary** - Peer-to-peer exchange without trusting a third party

## Architecture

The platform uses Zama FHEVM for end-to-end encrypted data management:

- **Smart contract:** `HonestCard.sol` manages card creation, exchange requests, and ACL-based access control
- **Encrypted fields:** Gender (euint8), Phone (euint64), Full Name (euint64), Social ID (euint128), Location (euint256)
- **Public fields:** Surname only - for identification without exposing sensitive data
- **Access control:** FHE.allow() grants decryption rights only after mutual exchange completion

## How It Works

```
1. Create Card    -> Store surname (public) + encrypted contact info
2. Browse Users   -> See surnames, but encrypted fields show "***"
3. Request Exchange -> Send exchange request to another user
4. Mutual Accept  -> When both parties request each other, exchange completes
5. Decrypt & View -> Both parties can now decrypt each other's full card
```

## Smart Contract

### Core Functions

| Function | Description |
|----------|-------------|
| `createCard()` | Create business card with public + encrypted fields |
| `updateCard()` | Update existing card (auto-syncs to all connections) |
| `requestExchange()` | Request card exchange with target address |
| `cancelRequest()` | Cancel pending exchange request |
| `getPublicInfo()` | Get public info (surname) of any user |
| `getEncryptedHandles()` | Get encrypted handles (only after exchange) |
| `getConnections()` | Get list of completed exchanges |

### Data Structure

```solidity
struct Card {
    string surname;      // Public - visible to all
    euint8 gender;       // Encrypted - 0=NotDisclosed, 1=Male, 2=Female, 3=Other
    euint64 phone;       // Encrypted - phone number
    euint64 fullName;    // Encrypted - full name
    euint128 socialId;   // Encrypted - social media handle
    euint256 location;   // Encrypted - location/address
    bool exists;
}
```

## Tech Stack

- **Blockchain:** Zama Protocol 
- **Frontend:** Next.js 15, React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Wallet:** RainbowKit + Wagmi v2
- **FHE SDK:** Zama Relayer SDK for client-side encryption/decryption

## Getting Started

```bash
# Install dependencies
pnpm install

# Set environment variables
cp env.template .env.local

# Run development server
pnpm dev
```

## Environment Variables

```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_CHAIN_ID=9000
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

## License

MIT
