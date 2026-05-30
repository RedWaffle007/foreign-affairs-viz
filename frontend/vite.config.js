import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Split the heavy graph library and React into separate cacheable
        // chunks so the app chunk stays small.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("react-force-graph") ||
            id.includes("force-graph") ||
            id.includes("/d3-")
          )
            return "force-graph";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler"))
            return "react-vendor";
          // Leave everything else with its importer to avoid cross-chunk cycles.
          return undefined;
        },
      },
    },
  },
});
