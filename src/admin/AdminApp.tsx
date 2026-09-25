import { Admin } from "react-admin";
import { createTheme } from "@mui/material/styles";
import AdminLogin from "./AdminLogin";
import { adminAuthProvider, adminDataProvider } from "./adminProviders";
import { AdminDashboard, AdminLayout, adminResources } from "./AdminPanel";

const adminTheme = createTheme({
  palette: { primary: { main: "#102318" }, secondary: { main: "#9fd72b" }, background: { default: "#f5f7f2" } },
  typography: { fontFamily: '"Manrope", sans-serif', h4: { fontWeight: 900 } },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none", borderRadius: 10 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
  },
});

export default function AdminApp() {
  return <Admin
    title="Пойдём · Админ-панель"
    dataProvider={adminDataProvider}
    authProvider={adminAuthProvider}
    loginPage={AdminLogin}
    dashboard={AdminDashboard}
    layout={AdminLayout}
    theme={adminTheme}
    requireAuth
    disableTelemetry
  >
    {adminResources}
  </Admin>;
}
