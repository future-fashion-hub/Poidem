import { useEffect, useRef, useState } from "react"
import LinkOutlined from "@mui/icons-material/LinkOutlined"
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined"
import { api } from "../api"
import {
  ApiError,
  type Company,
  type CompanyInvitation,
  type CompanyInvitationOptions,
} from "../api/types"
import { privateCompanyInviteUrl } from "../api/companyInvite"
import SiteSelect from "./SiteSelect"

export default function PrivateCompanyInvites({
  company,
}: {
  company: Company
}) {
  const [open, setOpen] = useState(false),
    [invitation, setInvitation] = useState<CompanyInvitation | null>(null)
  const [hours, setHours] =
      useState<CompanyInvitationOptions["expiresInHours"]>(168),
    [limit, setLimit] = useState(10)
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("")
  const operation = useRef(false),
    generation = useRef(0)
  useEffect(() => {
    const request = ++generation.current
    if (!open) return
    setLoading(true)
    setError("")
    api
      .getCompanyInvitation(company.id)
      .then((item) => {
        if (request === generation.current) setInvitation(item)
      })
      .catch((caught) => {
        if (request === generation.current)
          setError(
            caught instanceof ApiError && caught.status === 404
              ? "API закрытых компаний ещё не подключено к серверу."
              : caught instanceof Error
                ? caught.message
                : "Не удалось загрузить приглашение.",
          )
      })
      .finally(() => {
        if (request === generation.current) setLoading(false)
      })
    return () => {
      generation.current++
    }
  }, [open, company.id])
  const mutate = async (revoke: boolean) => {
    if (operation.current || loading) return
    if (!revoke && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
      setError("Укажите от 1 до 100 использований.")
      return
    }
    if (
      invitation &&
      !window.confirm(
        revoke
          ? "Отозвать приглашение? Старая ссылка перестанет работать. Участники останутся в компании."
          : "Создать новую ссылку? Предыдущая перестанет работать.",
      )
    )
      return
    operation.current = true
    setBusy(true)
    setError("")
    setNotice("")
    const request = generation.current
    try {
      if (revoke) {
        await api.revokeCompanyInvitation(company.id)
        if (request === generation.current) {
          setInvitation(null)
          setNotice("Ссылка отозвана. Состав компании не изменился.")
        }
      } else {
        const item = await api.createCompanyInvitation(company.id, {
          expiresInHours: hours,
          maxUses: limit,
        })
        if (request === generation.current) {
          setInvitation(item)
          setNotice(
            "Новая ссылка готова. Передавайте её только тем, кого хотите пригласить.",
          )
        }
      }
    } catch (caught) {
      if (request === generation.current)
        setError(
          caught instanceof ApiError && caught.status === 404
            ? "API закрытых компаний ещё не подключено к серверу."
            : caught instanceof Error
              ? caught.message
              : "Не удалось изменить приглашение.",
        )
    } finally {
      operation.current = false
      if (request === generation.current) setBusy(false)
    }
  }
  const url = invitation
    ? privateCompanyInviteUrl(
        invitation.token,
        window.location.origin,
        window.location.pathname,
      )
    : ""
  const active =
    invitation &&
    !invitation.revoked &&
    Date.parse(invitation.expiresAt) > Date.now() &&
    invitation.uses < invitation.maxUses
  return (
    <div className="company-invite-share">
      <button
        type="button"
        className="plans-button plans-button--secondary"
        aria-expanded={open}
        disabled={busy}
        onClick={() => {
          setOpen(!open)
          setNotice("")
        }}
      >
        <LinkOutlined aria-hidden="true" />
        Управлять приглашением
      </button>
      {open && (
        <div className="company-invite-share-panel">
          <p>
            Компания скрыта из общего списка. По ссылке доступен предпросмотр.
            Ссылку создаёт и отзывает организатор. Вступление — по правилам компании.
          </p>
          {loading ? (
            <p role="status">Загружаем приглашение…</p>
          ) : (
            <>
              <fieldset className="company-invite-options" disabled={busy}>
                <label>
                  Срок действия
                  <SiteSelect
                    value={hours}
                    onChange={(value) =>
                      setHours(Number(value) as typeof hours)
                    }
                    ariaLabel="Срок действия приглашения"
                    options={[
                      { value: 24, label: "1 день" },
                      { value: 168, label: "7 дней" },
                      { value: 720, label: "30 дней" },
                    ]}
                  />
                </label>
                <label>
                  Лимит использований
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    value={limit}
                    disabled={busy}
                    onChange={(event) => setLimit(Number(event.target.value))}
                  />
                </label>
              </fieldset>
              <p>
                Вступление или отправка заявки расходует одно использование.
                Заявка не занимает место до одобрения.
              </p>
              {invitation && (
                <>
                  <label>
                    Приглашение
                    <input
                      readOnly
                      value={url}
                      aria-label="Закрытая ссылка приглашения"
                      onFocus={(event) => event.target.select()}
                    />
                  </label>
                  <p role="status">
                    {active
                      ? "Действует"
                      : "Ссылка больше не принимает приглашения"}{" "}
                    · до{" "}
                    {new Date(invitation.expiresAt).toLocaleString("ru-RU")} ·
                    использовано {invitation.uses} из {invitation.maxUses}
                  </p>
                </>
              )}
              <div className="company-invite-share-actions">
                <button
                  type="button"
                  disabled={busy || company.status !== "active"}
                  onClick={() => {
                    void mutate(false)
                  }}
                >
                  {busy
                    ? "Сохраняем…"
                    : invitation
                      ? "Новая ссылка"
                      : "Создать ссылку"}
                </button>
                {invitation && (
                  <>
                    <button
                      type="button"
                      disabled={busy || !active}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url)
                          setNotice("Ссылка скопирована.")
                        } catch {
                          setNotice(
                            "Выделите ссылку в поле и скопируйте вручную.",
                          )
                        }
                      }}
                    >
                      <ContentCopyOutlined aria-hidden="true" />
                      Скопировать
                    </button>
                    <button
                      type="button"
                      className="company-invite-revoke"
                      disabled={busy}
                      onClick={() => {
                        void mutate(true)
                      }}
                    >
                      Отозвать ссылку
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          {error && (
            <p className="company-invite-error" role="alert">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
        </div>
      )}
    </div>
  )
}
