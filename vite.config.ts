import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        proxy: {
            // Proxy all requests to /megaeth-rpc to the MEGAETH RPC endpoint
            '/megaeth-rpc': {
                target: 'https://carrot.megaeth.com',
                changeOrigin: true,
                rewrite: (path) => '/rpc',  // Point to the /rpc endpoint
                configure: (proxy, _options) => {
                    proxy.on('error', (err, _req, _res) => {
                        console.log('proxy error', err);
                    });
                    proxy.on('proxyReq', (proxyReq, req, _res) => {
                        console.log('Sending Request to the Target:', req.method, req.url);
                        // Add CORS headers to the proxy request
                        proxyReq.setHeader('origin', 'https://carrot.megaeth.com');
                    });
                    proxy.on('proxyRes', (proxyRes, req, _res) => {
                        console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
                    });
                },
                // Properly handle CORS
                cors: true,
            },
        }
    }
});
