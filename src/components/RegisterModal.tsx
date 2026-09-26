import { useState } from "react";

type Provider = "google" | "telegram" | "vk";

export default function RegisterModal({ onClose, onRegister, onPasswordRegister }: { onClose: () => void; onRegister: (provider: Provider) => Promise<void>; onPasswordRegister: (username: string, password: string) => Promise<void> }) {
  const [accepted, setAccepted] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const showError = (caught: unknown) => setError(caught instanceof Error ? caught.message : "Не удалось создать аккаунт");
  const registerSocial = async (provider: Provider) => { setLoading(true); setError(""); try { await onRegister(provider); } catch (caught) { showError(caught); setLoading(false); } };
  const registerPassword = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (!accepted) return setError("Подтвердите согласие с правилами участия.");
    if (username.trim().length < 3) return setError("Логин должен состоять минимум из 3 символов.");
    if (password.length < 8) return setError("Пароль должен состоять минимум из 8 символов.");
    if (password !== repeatPassword) return setError("Пароли не совпадают.");
    setLoading(true); try { await onPasswordRegister(username.trim(), password); } catch (caught) { showError(caught); setLoading(false); }
  };

  return <div className="fixed inset-0 z-[65] grid place-items-center overflow-y-auto bg-[#08130d]/55 p-5 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="relative my-auto w-full max-w-xl rounded-[30px] bg-white p-7 shadow-2xl sm:p-9">
      <button onClick={onClose} aria-label="Закрыть регистрацию" className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-xl bg-[#eff4ec] text-lg text-[#526258]">×</button>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#bdf238] text-xl font-black">П</span>
      <h2 className="mt-5 text-3xl font-black tracking-[-.04em]">Создайте аккаунт</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#6a796d]">Зарегистрируйтесь, затем заполните профиль и находите события вместе с новыми людьми.</p>
      <form className="mt-7 space-y-4" onSubmit={registerPassword}>
        <label className="block text-sm font-bold">Логин<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={64} placeholder="Например, danila" className="mt-2 w-full rounded-xl border border-[#dce5da] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#86b92e]" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold">Пароль<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} placeholder="Минимум 8 символов" className="mt-2 w-full rounded-xl border border-[#dce5da] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#86b92e]" /></label><label className="block text-sm font-bold">Повторите пароль<input value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} placeholder="Повторите пароль" className="mt-2 w-full rounded-xl border border-[#dce5da] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#86b92e]" /></label></div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f1f6ee] p-4 text-xs leading-5 text-[#526258]"><input checked={accepted} onChange={(event) => setAccepted(event.target.checked)} type="checkbox" className="mt-0.5 h-4 w-4 accent-[#557d26]"/><span>Я принимаю правила и политику безопасного участия. <details className="mt-2 cursor-default"><summary className="font-bold text-[#416949] underline">Показать политику</summary><span className="mt-2 block">«Пойдём» помогает находить события и компании, но не является организатором мероприятия и не гарантирует поведение других участников. Каждый самостоятельно оценивает организатора, место и условия участия. За проведение и безопасность мероприятия отвечает организатор, а за собственные действия — каждый участник.</span></details></span></label>
        {error ? <p className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold text-[#9e3128]">{error}</p> : null}
        <button disabled={loading} className="w-full rounded-xl bg-[#102318] px-4 py-3.5 text-sm font-extrabold text-[#bdf238] disabled:opacity-50">{loading ? "Создаём аккаунт…" : "Создать аккаунт"}</button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[.12em] text-[#8a978c]"><span className="h-px flex-1 bg-[#e0e7de]"/>или через соцсеть<span className="h-px flex-1 bg-[#e0e7de]"/></div>
      <div className="grid gap-3 sm:grid-cols-3">{(["telegram", "vk", "google"] as const).map((provider) => <button key={provider} disabled={!accepted || loading} onClick={() => registerSocial(provider)} className={`rounded-xl px-3 py-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-45 ${provider === "telegram" ? "bg-[#52a8e7] text-white" : provider === "vk" ? "bg-[#1677f0] text-white" : "border border-[#dce5da] bg-white text-[#102318]"}`}>{provider === "telegram" ? "Telegram" : provider === "vk" ? "ВКонтакте" : "Google"}</button>)}</div>
      <p className="mt-5 text-center text-xs text-[#849187]">Уже есть аккаунт? <button onClick={onClose} className="font-bold text-[#416949] underline">Войти</button></p>
    </section>
  </div>;
}
