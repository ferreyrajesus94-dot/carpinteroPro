import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["favicon.ico", "icons/*.png"],
			manifest: {
				name: "CarpinteroPro",
				short_name: "CarpinteroPro",
				description: "Gestión integral de taller de carpintería",
				theme_color: "#1e293b",
				background_color: "#ffffff",
				display: "standalone",
				orientation: "portrait",
				start_url: "/dashboard",
				icons: [
					{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
					{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
					{
						src: "icons/icon-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
				skipWaiting: true,
				clientsClaim: true,
			},
		}),
	],
	resolve: {
		alias: { "@": path.resolve(__dirname, "./src") },
		dedupe: ["react", "react-dom"],
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./tests/setup.ts",
		exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
	},
});
