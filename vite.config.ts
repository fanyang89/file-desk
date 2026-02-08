import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fsApiPlugin } from "./src/api/fs-api-plugin";

export default defineConfig({
	plugins: [react(), fsApiPlugin()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
