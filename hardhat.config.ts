import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "solidity-coverage";
import "./tasks/seed";
import { HardhatUserConfig } from "hardhat/config";

const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL || "https://rpc.pharos.testnet";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PHAROS_CHAIN_ID = process.env.PHAROS_CHAIN_ID ? Number(process.env.PHAROS_CHAIN_ID) : 12345;
const SECP256K1_ORDER = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");

function isValidPrivateKey(privateKey?: string) {
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return false;
  }

  const keyValue = BigInt(privateKey);
  return keyValue > 0n && keyValue < SECP256K1_ORDER;
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    pharos: {
      url: PHAROS_RPC_URL,
      chainId: PHAROS_CHAIN_ID,
      accounts: isValidPrivateKey(PRIVATE_KEY) ? [PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: process.env.PHAROS_EXPLORER_API_KEY || ""
  }
};

export default config;
