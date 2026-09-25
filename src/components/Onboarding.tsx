import { useState } from "react";
import { api } from "../api";
import type { DictionaryItem, User } from "../api/types";

export default function Onboarding({ user, cities, categories, onComplete }: { user: User; cities: DictionaryItem[]; categories: DictionaryItem[]; onComplete: (user: User) => void }) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [cityId, setCityId] = useState(user.city?.id ?? 0);
  const [about, setAbout] = useState(user.about ?? "");
  const [interestIds, setInterestIds] = useState(user.interests.map((item) => item.id));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const chooseAvatar = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5_242_880) { setError("Выберите изображение JPG, PNG или WebP размером до 5 МБ."); return; }
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); setError("");
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !cityId) { setError("Укажите имя и город."); return; }
    setSaving(true); setError("");
    try {
      let next = await api.updateMyProfile({ firstName: firstName.trim(), lastName: lastName.trim() || null, cityId, about: about.trim() || null, interestIds });
      if (avatarFile) { const uploaded = await api.uploadMyAvatar(avatarFile); next = { ...next, avatarUrl: uploaded.avatarUrl }; }
      onComplete(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось сохранить профиль."); } finally { setSaving(false); }
  };
  return <main className="min-h-[calc(100vh-72px)] bg-[#f5f7f2] px-5 py-10"><div className="mx-auto max-w-3xl"><p className="mb-5 text-sm font-bold text-[#69826e]">Настройка личного профиля</p><form onSubmit={submit} className="rounded-[32px] border border-[#dce5da] bg-white p-6 shadow-[0_20px_60px_rgba(35,65,42,.06)] sm:p-10"><h1 className="text-center text-3xl font-black tracking-[-.04em] sm:text-4xl">Добро пожаловать в «Пойдём»!</h1><p className="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-[#718075]">Расскажите о себе, чтобы находить подходящие события и компании.</p><h2 className="mt-9 text-lg font-extrabold">Личная информация</h2><div className="mt-5 flex items-center gap-5 rounded-2xl bg-[#f7faf5] p-4"><label className="grid h-24 w-24 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-[#547b32] bg-[#eff9db] text-3xl text-[#24462d]">{avatarPreview ? <img src={avatarPreview} alt="Предпросмотр фотографии профиля" className="h-full w-full object-cover" /> : "+"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseAvatar(e.target.files?.[0])} className="sr-only" /></label><div><b className="text-sm">Фото профиля</b><p className="mt-1 text-xs leading-5 text-[#718075]">JPG, PNG или WebP, до 5 МБ. Другим будет проще узнать вас на событии.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Имя<input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} className="mt-2 w-full rounded-xl border border-[#dce5da] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#86b92e]" /></label><label className="text-sm font-bold">Фамилия<input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={100} className="mt-2 w-full rounded-xl border border-[#dce5da] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#86b92e]" /></label></div><label className="mt-4 block text-sm font-bold">Город проживания<select value={cityId} onChange={(e) => setCityId(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-[#dce5da] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#86b92e]"><option value={0}>Выберите город</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label><label className="mt-4 block text-sm font-bold">О себе<textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={2000} rows={4} placeholder="Расскажите, что вам интересно" className="mt-2 w-full resize-none rounded-xl border border-[#dce5da] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#86b92e]" /></label><h2 className="mt-7 text-lg font-extrabold">Выберите ваши интересы</h2><div className="mt-4 flex flex-wrap gap-2">{categories.map((category) => <button type="button" key={category.id} onClick={() => setInterestIds((ids) => ids.includes(category.id) ? ids.filter((id) => id !== category.id) : [...ids, category.id])} className={`rounded-full border px-4 py-2 text-sm font-bold ${interestIds.includes(category.id) ? "border-[#547b32] bg-[#eff9db] text-[#31513a]" : "border-[#dce5da] bg-white text-[#607267]"}`}>{category.name}</button>)}</div>{error && <p className="mt-5 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold text-[#9e3128]">{error}</p>}<button disabled={saving} className="mt-8 w-full rounded-2xl bg-[#102318] py-4 text-sm font-extrabold text-[#bdf238] disabled:opacity-50">{saving ? "Сохраняем…" : "Сохранить и продолжить"}</button></form></div></main>;
}
