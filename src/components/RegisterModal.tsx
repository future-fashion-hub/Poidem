import { useState } from "react";
import BrandLogo from "./BrandLogo";
import SocialAuthButtons, { type SocialProvider } from "./SocialAuthButtons";
import PasswordVisibilityButton from "./PasswordVisibilityButton";

export default function RegisterModal({ onClose, onLogin, onRegister, onPasswordRegister }: { onClose: () => void; onLogin: () => void; onRegister: (provider: SocialProvider) => Promise<void>; onPasswordRegister: (username: string, password: string) => Promise<void> }) {
  const [accepted, setAccepted] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const showError = (caught: unknown) => setError(caught instanceof Error ? caught.message : "Не удалось создать аккаунт");
  const registerSocial = async (provider: SocialProvider) => { setLoading(true); setError(""); try { await onRegister(provider); } catch (caught) { showError(caught); setLoading(false); } };
  const registerPassword = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (!accepted) return setError("Подтвердите согласие с правилами участия.");
    if (username.trim().length < 3) return setError("Логин должен состоять минимум из 3 символов.");
    if (password.length < 8) return setError("Пароль должен состоять минимум из 8 символов.");
    if (password !== repeatPassword) return setError("Пароли не совпадают.");
    setLoading(true); try { await onPasswordRegister(username.trim(), password); } catch (caught) { showError(caught); setLoading(false); }
  };

  return <div className="auth-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="auth-card auth-card--register" role="dialog" aria-modal="true" aria-labelledby="register-title">
      <button type="button" onClick={onClose} aria-label="Закрыть регистрацию" className="auth-close">×</button>
      <BrandLogo/>
      <div className="auth-progress" aria-label="Этап регистрации"><span className="is-active"><i>1</i>Аккаунт</span><b/><span><i>2</i>Профиль</span></div>
      <header className="auth-heading"><p>Начнём с основного</p><h2 id="register-title">Создайте аккаунт</h2><span>После этого останется коротко рассказать о себе и выбрать интересы.</span></header>
      <form className="auth-form auth-register-form" onSubmit={registerPassword}>
        <label><span>Логин</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={64} placeholder="Например, danila" /></label>
        <div className="auth-form-grid">
          <label><span>Пароль</span><div className="auth-password"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} placeholder="Минимум 8 символов"/><PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword((value) => !value)}/></div></label>
          <label><span>Повторите пароль</span><div className="auth-password"><input value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} type={showRepeatPassword ? "text" : "password"} autoComplete="new-password" minLength={8} placeholder="Повторите пароль"/><PasswordVisibilityButton visible={showRepeatPassword} onToggle={() => setShowRepeatPassword((value) => !value)}/></div></label>
        </div>
        <div className="auth-policy"><input id="registration-policy" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} type="checkbox"/><div><label htmlFor="registration-policy"><strong>Принимаю правила безопасного участия</strong><small>Платформа помогает найти компанию, но не является организатором мероприятия.</small></label><details><summary>Прочитать подробнее</summary><p>«Пойдём» не гарантирует поведение других участников. Каждый самостоятельно оценивает организатора, место и условия участия. За проведение и безопасность мероприятия отвечает организатор, а за собственные действия — каждый участник.</p></details></div></div>
        {error ? <p role="alert" className="auth-error">{error}</p> : null}
        <button disabled={loading} className="auth-submit">{loading ? "Создаём аккаунт…" : "Создать аккаунт"}</button>
      </form>
      <div className="auth-divider"><span/>или через соцсеть<span/></div>
      <SocialAuthButtons providers={["telegram", "vk", "google"]} disabled={!accepted || loading} onSelect={registerSocial}/>
      <p className="auth-switch">Уже есть аккаунт? <button type="button" onClick={onLogin}>Войти</button></p>
    </section>
  </div>;
}
