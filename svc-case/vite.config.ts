import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    base: '/cases',

    server: {
      proxy: {
        "/sap": {
          target: env.VITE_SAP_HOST,
          changeOrigin: true,
          secure: false,

          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              const token = Buffer.from(
                `${env.VITE_SAP_USERNAME}:${env.VITE_SAP_PASSWORD}`
              ).toString("base64");

              proxyReq.setHeader("Authorization", `Basic ${token}`);
            });
          },
        },
      },
    },
  };
});