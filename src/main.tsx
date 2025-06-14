import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// UI
import App from "./App.tsx";
import { PrivyProvider } from "@privy-io/react-auth";

// Utils
import { megaethTestnet } from "viem/chains";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <PrivyProvider
            appId={import.meta.env.VITE_PRIVY_APP_ID}
            config={{
                appearance: {
                    theme: "light",
                    walletChainType: "ethereum-only",
                },
                defaultChain: megaethTestnet,
                supportedChains: [megaethTestnet],
                loginMethods: ["google", "passkey"],
                embeddedWallets: {
                    ethereum: { createOnLogin: "users-without-wallets" },
                },
            }}
        >
            <App />
        </PrivyProvider>
    </StrictMode>
);
