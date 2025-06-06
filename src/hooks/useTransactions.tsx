import { Button } from "@/components/ui/button";
import { publicClient } from "@/utils/client";
import { GAME_CONTRACT_ADDRESS } from "@/utils/constants";
import { post } from "@/utils/fetch";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
    createWalletClient,
    custom,
    encodeFunctionData,
    formatEther,
    Hex,
    parseEther,
    parseGwei,
} from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { megaethTestnet } from "viem/chains";

export function useTransactions() {
    // User and Wallet objects.
    const { user } = usePrivy();
    const { ready, wallets } = useWallets();

    // Fetch user nonce on new login.
    const userNonce = useRef(0);
    const userBalance = useRef(0n);
    const userAddress = useRef("");

    // Resets nonce and balance
    async function resetNonceAndBalance() {
        if (!user) {
            return;
        }
        const [privyUser] = user.linkedAccounts.filter(
            (account) =>
                account.type === "wallet" &&
                account.walletClientType === "privy"
        );
        if (!privyUser || !(privyUser as any).address) {
            return;
        }
        const privyUserAddress = (privyUser as any).address;

        const nonce = await publicClient.getTransactionCount({
            address: privyUserAddress as Hex,
        });
        const balance = await publicClient.getBalance({
            address: privyUserAddress as Hex,
        });

        console.log("Setting nonce: ", nonce);
        console.log("Setting balance: ", balance.toString());

        userNonce.current = nonce;
        userBalance.current = balance;
        userAddress.current = privyUserAddress;
    }

    useEffect(() => {
        resetNonceAndBalance();
    }, [user]);

    // Fetch provider on new login.
    const walletClient = useRef<any>(null);
    useEffect(() => {
        async function getWalletClient() {
            if (!ready || !wallets) return;

            const userWallet = wallets.find(
                (w) => w.walletClientType == "privy"
            );
            if (!userWallet) return;

            const ethereumProvider = await userWallet.getEthereumProvider();
            const provider = createWalletClient({
                chain: megaethTestnet,
                transport: custom(ethereumProvider),
            });

            console.log("Setting provider: ", provider);
            walletClient.current = provider;
        }

        getWalletClient();
    }, [user, ready, wallets]);

    // Get current gas price from the network
    async function getCurrentGasPrices() {
        try {
            // Get current base fee
            const latestBlock = await publicClient.getBlock();
            const baseFeePerGas = latestBlock.baseFeePerGas || parseGwei("1");
            
            // Set maxFeePerGas to baseFee * 2 for better chances of inclusion
            // Set maxPriorityFeePerGas to a reasonable tip
            const maxFeePerGas = baseFeePerGas * 2n;
            const maxPriorityFeePerGas = parseGwei("1"); // 1 Gwei tip
            
            console.log("Current base fee:", baseFeePerGas.toString());
            console.log("Max fee per gas:", maxFeePerGas.toString());
            console.log("Max priority fee:", maxPriorityFeePerGas.toString());
            
            return { maxFeePerGas, maxPriorityFeePerGas };
        } catch (error) {
            console.warn("Failed to get current gas prices, using defaults:", error);
            // Fallback to higher defaults if network call fails
            return {
                maxFeePerGas: parseGwei("2.0"), // Increased from 0.05
                maxPriorityFeePerGas: parseGwei("1.0"), // Increased from 0.01
            };
        }
    }

    // Estimate gas for a transaction
    async function estimateGas(data: Hex): Promise<bigint> {
        try {
            const privyUserAddress = userAddress.current;
            if (!privyUserAddress) {
                throw new Error("User address not available");
            }

            const estimatedGas = await publicClient.estimateGas({
                account: privyUserAddress as Hex,
                to: GAME_CONTRACT_ADDRESS,
                data,
            });

            // Add 20% buffer to the estimated gas
            const gasWithBuffer = (estimatedGas * 120n) / 100n;
            
            console.log("Estimated gas:", estimatedGas.toString());
            console.log("Gas with buffer:", gasWithBuffer.toString());
            
            return gasWithBuffer;
        } catch (error) {
            console.warn("Gas estimation failed, using fallback:", error);
            // Return a conservative fallback gas limit
            return BigInt(100000); // Reduced from 300k/200k
        }
    }

    // Sends a transaction and wait for receipt.
    async function sendRawTransactionAndConfirm({
        successText,
        data,
        nonce,
        gas,
        maxFeePerGas,
        maxPriorityFeePerGas,
    }: {
        successText?: string;
        data: Hex;
        nonce: number;
        gas?: BigInt;
        maxFeePerGas?: BigInt;
        maxPriorityFeePerGas?: BigInt;
    }) {
        let e: Error | null = null;

        try {
            // Sign and send transaction.
            const provider = walletClient.current;
            if (!provider) {
                throw Error("Wallet not found.");
            }
            const privyUserAddress = userAddress.current;
            if (!privyUserAddress) {
                throw Error("Privy user not found.");
            }

            // Get current gas prices if not provided
            const gasParams = maxFeePerGas && maxPriorityFeePerGas 
                ? { maxFeePerGas, maxPriorityFeePerGas }
                : await getCurrentGasPrices();

            // Estimate gas if not provided
            const gasLimit = gas || await estimateGas(data);

            const startTime = Date.now();
            // Sign with explicit EIP-1559 parameters
            const signedTransaction = await provider.signTransaction({
                to: GAME_CONTRACT_ADDRESS,
                account: privyUserAddress,
                data,
                nonce,
                gas: gasLimit,
                maxFeePerGas: gasParams.maxFeePerGas,
                maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
            });

            
            const rpcUrl = window.location.hostname === 'localhost' 
                ? '/megaeth-rpc'  
                : 'https://carrot.megaeth.com/rpc'; 

            const response = await post({
                url: rpcUrl,
                params: {
                    id: 0,
                    jsonrpc: "2.0",
                    method: "eth_sendRawTransaction",
                    params: [signedTransaction],
                },
                includeCredentials: false, 
                
                headers: {
                    'Content-Type': 'application/json',
                },
                
                retries: 3,
                retryDelay: 2000
            });
            
            const time = Date.now() - startTime;

            if (response.error) {
                console.log(`Failed sent in ${time} ms`);
                throw Error(response.error.message);
            }

            const transactionHash: Hex = response.result;

            // Fire toast info with benchmark and transaction hash.
            console.log(`Transaction sent in ${time} ms: ${response.result}`);
            toast.info(`Sent transaction.`, {
                description: `${successText} Time: ${time} ms`,
                action: (
                    <Button
                        className="outline outline-white"
                        onClick={() =>
                            window.open(
                                `https://megaexplorer.xyz/tx/${transactionHash}`,
                                "_blank",
                                "noopener,noreferrer"
                            )
                        }
                    >
                        <div className="flex items-center gap-1 p-1">
                            <p>View</p>
                            <ExternalLink className="w-4 h-4" />
                        </div>
                    </Button>
                ),
            });

            // Confirm transaction
            const receipt = await waitForTransactionReceipt(publicClient, {
                hash: transactionHash,
            });

            if (receipt.status == "reverted") {
                console.log(
                    `Failed confirmation in ${Date.now() - startTime} ms`
                );
                throw Error(
                    `Failed to confirm transaction: ${transactionHash}`
                );
            }

            console.log(
                `Transaction confirmed in ${Date.now() - startTime} ms: ${
                    response.result
                }`
            );
            toast.success(`Confirmed transaction.`, {
                description: `${successText} Time: ${
                    Date.now() - startTime
                } ms`,
                action: (
                    <Button
                        className="outline outline-white"
                        onClick={() =>
                            window.open(
                                `https://megaexplorer.xyz/tx/${transactionHash}`,
                                "_blank",
                                "noopener,noreferrer"
                            )
                        }
                    >
                        <div className="flex items-center gap-1 p-1">
                            <p>View</p>
                            <ExternalLink className="w-4 h-4" />
                        </div>
                    </Button>
                ),
            });
        } catch (error) {
            e = error as Error;

            toast.error(`Failed to send transaction.`, {
                description: `Error: ${e.message}`,
            });
        }

        if (e) {
            throw e;
        }
    }

    // Returns a the latest stored board of a game as an array.
    async function getLatestGameBoard(
        gameId: Hex
    ): Promise<
        readonly [
            readonly [
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number
            ],
            bigint
        ]
    > {
        const [latestBoard, nextMoveNumber] = await publicClient.readContract({
            address: GAME_CONTRACT_ADDRESS,
            abi: [
                {
                    type: "function",
                    name: "getBoard",
                    inputs: [
                        {
                            name: "gameId",
                            type: "bytes32",
                            internalType: "bytes32",
                        },
                    ],
                    outputs: [
                        {
                            name: "boardArr",
                            type: "uint8[16]",
                            internalType: "uint8[16]",
                        },
                        {
                            name: "nextMoveNumber",
                            type: "uint256",
                            internalType: "uint256",
                        },
                    ],
                    stateMutability: "view",
                },
            ],
            functionName: "getBoard",
            args: [gameId],
        });

        return [latestBoard, nextMoveNumber];
    }

    // Initializes a game. Calls `prepareGame` and `startGame`.
    async function initializeGameTransaction(
        gameId: Hex,
        boards: readonly [bigint, bigint, bigint, bigint],
        moves: readonly [number, number, number]
    ): Promise<void> {
        const balance = userBalance.current;
        if (parseFloat(formatEther(balance)) < 0.01) {
            throw Error("Signer has insufficient balance.");
        }

        // Sign and send transaction: start game
        console.log("Starting game!");

        const data = encodeFunctionData({
            abi: [
                {
                    type: "function",
                    name: "startGame",
                    inputs: [
                        {
                            name: "gameId",
                            type: "bytes32",
                            internalType: "bytes32",
                        },
                        {
                            name: "boards",
                            type: "uint128[4]",
                            internalType: "uint128[4]",
                        },
                        {
                            name: "moves",
                            type: "uint8[3]",
                            internalType: "uint8[3]",
                        },
                    ],
                    outputs: [],
                    stateMutability: "nonpayable",
                },
            ],
            functionName: "startGame",
            args: [gameId, boards, moves],
        });

        const nonce = userNonce.current;
        userNonce.current = nonce + 1;
        userBalance.current = balance - parseEther("0.0075");

        await sendRawTransactionAndConfirm({
            nonce: nonce,
            successText: "Started game!",
            data,
            // Let the function estimate gas and get current gas prices
        });
    }

    async function playNewMoveTransaction(
        gameId: Hex,
        board: bigint,
        move: number,
        moveCount: number
    ): Promise<void> {
        // Sign and send transaction: play move
        console.log(`Playing move ${moveCount}!`);

        const balance = userBalance.current;
        if (parseFloat(formatEther(balance)) < 0.01) {
            throw Error("Signer has insufficient balance.");
        }

        const data = encodeFunctionData({
            abi: [
                {
                    type: "function",
                    name: "play",
                    inputs: [
                        {
                            name: "gameId",
                            type: "bytes32",
                            internalType: "bytes32",
                        },
                        {
                            name: "move",
                            type: "uint8",
                            internalType: "uint8",
                        },
                        {
                            name: "resultBoard",
                            type: "uint128",
                            internalType: "uint128",
                        },
                    ],
                    outputs: [],
                    stateMutability: "nonpayable",
                },
            ],
            functionName: "play",
            args: [gameId, move, board],
        });

        const nonce = userNonce.current;
        userNonce.current = nonce + 1;
        userBalance.current = balance - parseEther("0.005");

        await sendRawTransactionAndConfirm({
            nonce,
            successText: `Played move ${moveCount}`,
            data,
            // Let the function estimate gas and get current gas prices
        });
    }

    return {
        resetNonceAndBalance,
        initializeGameTransaction,
        playNewMoveTransaction,
        getLatestGameBoard,
    };
}
