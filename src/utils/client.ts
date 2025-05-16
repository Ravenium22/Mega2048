import { megaethTestnet } from "viem/chains";
import { createPublicClient, http } from "viem";

const environment = import.meta.env.VITE_APP_ENVIRONMENT;
const rpc =
    environment === "prod"
        ? import.meta.env.VITE_MEGAETH_RPC_URL! ||
          megaethTestnet.rpcUrls.default.http[0]
        : megaethTestnet.rpcUrls.default.http[0];

export const publicClient = createPublicClient({
    chain: megaethTestnet,
    transport: http(rpc),
});
