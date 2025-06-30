import "dotenv/config"
import {
  createKernelAccount,
  createZeroDevPaymasterClient,
  createKernelAccountClient,
  getUserOperationGasPrice,
  createFallbackKernelAccountClient,
} from "@zerodev/sdk"
import { createEcdsaKernelMigrationAccount, signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import { http, Hex, createPublicClient, zeroAddress, Address, isAddressEqual, defineChain } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { KERNEL_V3_0, KERNEL_V3_2, KernelVersionToAddressesMap } from "@zerodev/sdk/constants"
import {
  entryPoint07Address,
  EntryPointVersion,
} from "viem/account-abstraction"
import { getKernelImplementationAddress, getKernelVersion } from "@zerodev/sdk/actions"
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createPaymasterClient } from "viem/account-abstraction";



const BUNDLER_RPC = `http://127.0.0.1:6752/bundler/rpc`
const PAYMASTER_RPC = `http://127.0.0.1:6752/paymaster`
const APPRPC = `http://127.0.0.1:6752/anvil`

export const cannon = /*#__PURE__*/ defineChain({
  id: 13_370,
  name: 'Cannon',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:6752/anvil'] },
  },
})


const cartesi = defineChain({
  ...cannon,
  rpcUrls: { default: { http: [APPRPC] } },
});

const chain = cartesi;

const publicClient = createPublicClient({
  chain,
  transport: http(APPRPC),
})

const signer = privateKeyToAccount(generatePrivateKey() as Hex)
const entryPoint = {
  address: entryPoint07Address as Address,
  version: "0.7" as EntryPointVersion,
}

const main = async () => {
  const originalKernelVersion = KERNEL_V3_2
  console.log("Started");


  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint,
    kernelVersion: originalKernelVersion,
  })
  console.log("validator created:", ecdsaValidator.address);


  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    address: signer.address,
    entryPoint,
    kernelVersion: originalKernelVersion,
  })
  console.log("My account:", account.address)


  const estimateFeesPerGas = async () => {
      const pimlicoClient = createPimlicoClient({
          transport: http(BUNDLER_RPC),
      });
      const gas = await pimlicoClient.getUserOperationGasPrice();
      return gas.standard;
  };



  const paymasterClient = createZeroDevPaymasterClient({
    chain,
    transport: http(PAYMASTER_RPC),
  })

  const paymasterClient2 = createPaymasterClient({
    transport: http(PAYMASTER_RPC),
})

  

  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(BUNDLER_RPC),
    userOperation: { estimateFeesPerGas },
    client: publicClient,
    paymaster: paymasterClient2,
  })

  const kernelClient2 = createKernelAccountClient({
      account,
      chain,
      bundlerTransport: http(BUNDLER_RPC),
      client: publicClient,
      paymaster: {
        getPaymasterData: (userOperation) => {
          return paymasterClient.sponsorUserOperation({
            userOperation,
          })
        }
    },
  })


  console.log("client1 created, address::", kernelClient.account.accountImplementationAddress);
  console.log("client2 created, address::", kernelClient2.account.accountImplementationAddress);

  // const fallbackKernelClient = createFallbackKernelAccountClient([
  //   kernelClient
  // ])
  // console.log("Account address:", fallbackKernelClient.account.address)

  // const txHash = await fallbackKernelClient.sendTransaction({
  //   to: zeroAddress,
  //   value: BigInt(0),
  //   data: "0x"
  // })

  // console.log("Txn hash:", txHash)

  const userOpHash = await kernelClient.sendUserOperation({
    callData: await kernelClient.account.encodeCalls([{
      to: zeroAddress,
      value: BigInt(0),
      data: "0x",
    }]),
  })
  console.log("UserOp hash:", userOpHash)



}

main()
