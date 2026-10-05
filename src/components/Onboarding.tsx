import { useState } from "react"
import { api } from "../api"
import type { DictionaryItem, User } from "../api/types"
import SiteSelect from "./SiteSelect"
import SiteDatePicker from "./SiteDatePicker"
import { FiMapPin, FiStar, FiUser } from "react-icons/fi"

export default function Onboarding({
  user,
  cities,
  interests,
  onComplete,
}: {
  user: User
  cities: DictionaryItem[]
  interests: DictionaryItem[]
  onComplete: (user: User) => void
}) {
  const [firstName, setFirstName] = useState(user.firstName ?? "")
  const [lastName, setLastName] = useState(user.lastName ?? "")
  const [cityId, setCityId] = useState(user.city?.id ?? 0)
  const [about, setAbout] = useState(user.about ?? "")
  const [gender, setGender] = useState<User["gender"]>(user.gender ?? null)
  const [birthDate, setBirthDate] = useState(user.birthDate ?? "")
  const [interestIds, setInterestIds] = useState(
    user.interests.map((item) => item.id),
  )
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !cityId) {
      setError("Укажите имя и город.")
      return
    }
    if (birthDate && birthDate > new Date().toISOString().slice(0, 10)) {
      setError("Дата рождения не может быть в будущем.")
      return
    }
    setSaving(true)
    try {
      let next = await api.updateMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        cityId,
        about: about.trim() || null,
        gender,
        birthDate: birthDate || null,
        interestIds,
      })
      if (avatarFile) {
        const uploaded = await api.uploadMyAvatar(avatarFile)
        next = { ...next, avatarUrl: uploaded.avatarUrl }
      }
      onComplete(next)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось сохранить профиль.",
      )
    } finally {
      setSaving(false)
    }
  }
  const avatar = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith("image/") || file.size > 5_242_880) {
      setError("Выберите изображение до 5 МБ.")
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }
  const previewName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || "Ваше имя"
  const previewCity = cities.find((city) => city.id === cityId)?.name ?? "Ваш город"
  const previewInterests = interests.filter((interest) => interestIds.includes(interest.id)).slice(0, 3)
  const previewInitial = (firstName.trim().charAt(0) || user.firstName?.charAt(0) || "П").toUpperCase()
  return (
    <main className="onboarding-page">
      <div className="onboarding-layout">
        <aside className="onboarding-intro">
          <div><p>Финальный шаг</p><h1>Осталось познакомиться<span>.</span></h1><div>Расскажите немного о себе — так рекомендации станут точнее, а новым знакомым будет проще начать разговор.</div></div>
          <article className="onboarding-preview" aria-label="Предпросмотр вашего профиля">
            <header className="onboarding-preview-header">
              <span><FiStar aria-hidden="true"/>Ваш профиль</span>
              <small>Предпросмотр</small>
            </header>
            <div className="onboarding-preview-person">
              <span className="onboarding-preview-avatar">
                {avatarPreview ? <img src={avatarPreview} alt=""/> : previewInitial}
              </span>
              <div>
                <h2>{previewName}</h2>
                <p><FiMapPin aria-hidden="true"/>{previewCity}</p>
              </div>
            </div>
            <p className={`onboarding-preview-about${about.trim() ? "" : " is-placeholder"}`}>
              {about.trim() || "Здесь появится несколько слов о вас — коротко, живо и по делу."}
            </p>
            <div className="onboarding-preview-interests" aria-label="Выбранные интересы">
              {previewInterests.length
                ? previewInterests.map((interest) => <span key={interest.id}>{interest.name}</span>)
                : <><span className="is-placeholder">Музыка</span><span className="is-placeholder">Прогулки</span><span className="is-placeholder">Новое</span></>}
            </div>
            <footer><FiStar aria-hidden="true"/><span>После сохранения мы подберём события и компании точнее.</span></footer>
          </article>
          <div className="auth-progress auth-progress--inverse" aria-label="Этап регистрации"><span><i>1</i>Аккаунт</span><b/><span className="is-active"><i>2</i>Профиль</span></div>
          <ul><li><span>01</span>Настройте профиль</li><li><span>02</span>Выберите интересы</li><li><span>03</span>Найдите свой план</li></ul>
        </aside>
        <form onSubmit={submit} className="onboarding-form">
          <header><p>Личный профиль</p><h2>Расскажите о себе</h2><span>Поля можно изменить позже в разделе «Мои планы».</span></header>
          <section className="onboarding-section">
            <div className="onboarding-section-title"><span>01</span><div><h3>Основная информация</h3><p>Как к вам обращаться и где вы ищете события.</p></div></div>
            <div className="profile-photo-picker">
            <span className={`profile-photo-preview${avatarPreview ? "" : " profile-photo-preview--empty"}`}>
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Фото профиля"
                  className="h-full w-full object-cover"
                />
              ) : <FiUser aria-hidden="true"/>}
            </span>
            <div className="profile-photo-copy"><strong>Фото профиля</strong><span>Поможет участникам узнать вас. JPG, PNG или WebP до 5 МБ.</span></div>
            <div className="profile-photo-actions"><label className="profile-photo-button">Выбрать фото<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => avatar(event.target.files?.[0])}/></label></div>
          </div>
          <div className="onboarding-grid">
            <label className="text-sm font-bold">
              Имя
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#dce5da] px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              Фамилия
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#dce5da] px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              Пол
              <SiteSelect
                value={gender ?? ""}
                onChange={(value) => setGender((value || null) as User["gender"])}
                className="mt-2 font-normal"
                options={[{ value: "", label: "Не указывать" }, { value: "male", label: "Мужской" }, { value: "female", label: "Женский" }]}
              />
            </label>
            <label className="text-sm font-bold">
              Дата рождения
              <SiteDatePicker
                max={new Date().toISOString().slice(0, 10)}
                value={birthDate}
                onChange={setBirthDate}
                placeholder="Выберите дату рождения"
                ariaLabel="Дата рождения"
                className="mt-2 font-normal"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm font-bold">
            Город
            <SiteSelect
              value={cityId}
              onChange={(value) => setCityId(Number(value))}
              className="mt-2 font-normal"
              options={[{ value: 0, label: "Выберите город" }, ...cities.map((city) => ({ value: city.id, label: city.name }))]}
            />
          </label>
          </section>
          <section className="onboarding-section">
          <div className="onboarding-section-title"><span>02</span><div><h3>Несколько слов о вас</h3><p>Необязательно писать много — достаточно пары живых деталей.</p></div></div>
          <label className="block text-sm font-bold">
            О себе
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-[#dce5da] px-4 py-3 font-normal"
            />
          </label>
          </section>
          <section className="onboarding-section">
          <div className="onboarding-section-title"><span>03</span><div><h3>Что вам интересно?</h3><p>Можно выбрать несколько вариантов.</p></div></div>
          <div className="discovery-categories interest-selector" aria-label="Выбор интересов">
            {interests.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={interestIds.includes(item.id)}
                onClick={() =>
                  setInterestIds((ids) =>
                    ids.includes(item.id)
                      ? ids.filter((id) => id !== item.id)
                      : [...ids, item.id],
                  )
                }
              >
                {item.name}
              </button>
            ))}
          </div>
          </section>
          {error && (
            <p role="alert" className="auth-error">{error}</p>
          )}
          <button
            disabled={saving}
            className="onboarding-submit"
          >
            {saving ? "Сохраняем…" : "Завершить настройку"}
          </button>
        </form>
      </div>
    </main>
  )
}
