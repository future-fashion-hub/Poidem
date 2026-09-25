import { FormEvent, useState } from "react";
import { Alert, Box, Button, Card, CircularProgress, TextField, Typography } from "@mui/material";
import { useLogin, useNotify } from "react-admin";
import { backendMode } from "../api";

export default function AdminLogin() {
  const login = useLogin();
  const notify = useNotify();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("poydem2026");
  const [loading, setLoading] = useState(false);

  if (backendMode) {
    const signInWithGoogle = () => {
      sessionStorage.setItem("poydem_after_oauth", "/admin#/");
      window.location.assign("/api/v1/auth/google");
    };
    return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, bgcolor: "#eef3ea", backgroundImage: "radial-gradient(#a8b9a8 1px, transparent 1px)", backgroundSize: "24px 24px" }}><Card sx={{ width: "100%", maxWidth: 440, p: { xs: 3, sm: 4 }, borderRadius: 5, boxShadow: "0 28px 80px rgba(13,40,24,.16)" }}><Box sx={{ width: 52, height: 52, display: "grid", placeItems: "center", borderRadius: 3, bgcolor: "#bdf238", color: "#102318", fontSize: 24, fontWeight: 900 }}>П</Box><Typography variant="overline" sx={{ display: "block", mt: 3, color: "#64806a", fontWeight: 800, letterSpacing: ".16em" }}>Пойдём</Typography><Typography variant="h4" sx={{ mt: .5, fontWeight: 900, letterSpacing: "-.04em" }}>Войти</Typography><Typography sx={{ mt: 1, color: "text.secondary", lineHeight: 1.6 }}>Войдите через свой аккаунт. Доступные разделы определяются правами пользователя после авторизации.</Typography><Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>Для прав администратора укажите ID пользователя в <b>BOOTSTRAP_ADMIN_USER_ID</b> и перезапустите API.</Alert><Button onClick={signInWithGoogle} variant="contained" fullWidth size="large" sx={{ mt: 3, minHeight: 50, borderRadius: 2.5, bgcolor: "#102318", fontWeight: 800, "&:hover": { bgcolor: "#234b30" } }}>Войти через Google</Button><Button href="/" fullWidth sx={{ mt: 1.5, color: "#56705d" }}>Вернуться на сайт</Button></Card></Box>;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login({ username, password });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось войти", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, bgcolor: "#eef3ea", backgroundImage: "radial-gradient(#a8b9a8 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
    <Card component="form" onSubmit={submit} sx={{ width: "100%", maxWidth: 440, p: { xs: 3, sm: 4 }, borderRadius: 5, boxShadow: "0 28px 80px rgba(13,40,24,.16)" }}>
      <Box sx={{ width: 52, height: 52, display: "grid", placeItems: "center", borderRadius: 3, bgcolor: "#bdf238", color: "#102318", fontSize: 24, fontWeight: 900 }}>П</Box>
      <Typography variant="overline" sx={{ display: "block", mt: 3, color: "#64806a", fontWeight: 800, letterSpacing: ".16em" }}>Пойдём · управление</Typography>
      <Typography variant="h4" sx={{ mt: .5, fontWeight: 900, letterSpacing: "-.04em" }}>Войти</Typography>
      <Typography sx={{ mt: 1, color: "text.secondary", lineHeight: 1.6 }}>Введите логин и пароль. Доступные разделы определяются правами аккаунта после входа.</Typography>
      <Box sx={{ display: "grid", gap: 2, mt: 3 }}>
        <TextField label="Логин" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus required fullWidth />
        <TextField label="Пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required fullWidth />
      </Box>
      <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>Демо-доступ: <b>admin</b> / <b>poydem2026</b></Alert>
      <Button type="submit" variant="contained" disabled={loading} fullWidth size="large" sx={{ mt: 3, minHeight: 50, borderRadius: 2.5, bgcolor: "#102318", fontWeight: 800, "&:hover": { bgcolor: "#234b30" } }}>
        {loading ? <CircularProgress size={23} color="inherit" /> : "Войти"}
      </Button>
      <Button href="/" fullWidth sx={{ mt: 1.5, color: "#56705d" }}>Вернуться на сайт</Button>
    </Card>
  </Box>;
}
