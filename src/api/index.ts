import { backendApi, backendMode } from "./backendApi";
import { mockApi } from "./mockApi";

// The mock is retained solely for standalone UI work. Set VITE_API_MODE=backend
// after Docker and OAuth are configured to use the Go API.
export const api = backendMode ? backendApi : mockApi;
export { backendMode };
