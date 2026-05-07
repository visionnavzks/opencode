import { defineConfig } from "vite"
import solidPlugin from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "url"

export default defineConfig({
  plugins: [
    {
      name: "web-app:config",
      config() {
        return {
          resolve: {
            alias: {
              "@": fileURLToPath(new URL("./src", import.meta.url)),
            },
          },
          worker: {
            format: "es" as const,
          },
        }
      },
    },
    tailwindcss(),
    solidPlugin(),
  ],
  server: {
    host: "0.0.0.0",
    port: 3100,
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
})
