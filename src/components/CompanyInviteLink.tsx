import { useState } from "react"
import LinkOutlined from "@mui/icons-material/LinkOutlined"
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined"
import ShareOutlined from "@mui/icons-material/ShareOutlined"
import type { Company } from "../api/types"
import { companyInviteUrl } from "../api/companyInvite"
import "./companyInvite.css"
import PrivateCompanyInvites from "./PrivateCompanyInvites"

export default function CompanyInviteLink({
  company,
  canManage = false,
}: {
  company: Company
  canManage?: boolean
}) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const url = companyInviteUrl(
    company.id,
    window.location.origin,
    window.location.pathname,
  )
  const copy = async () => {
    setBusy(true)
    setMessage("")
    try {
      await navigator.clipboard.writeText(url)
      setMessage("Ссылка скопирована. Отправьте её друзьям.")
    } catch {
      setMessage(
        "Не удалось скопировать автоматически. Выделите ссылку в поле и скопируйте её вручную.",
      )
    } finally {
      setBusy(false)
    }
  }
  const share = async () => {
    if (!navigator.share) {
      await copy()
      return
    }
    setBusy(true)
    setMessage("")
    try {
      await navigator.share({
        title: company.name,
        text: "Пойдём вместе! Присоединяйтесь к компании.",
        url,
      })
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        setMessage("Не удалось отправить ссылку. Её можно скопировать из поля.")
    } finally {
      setBusy(false)
    }
  }
  if (company.visibility === "private")
    return canManage ? (
      <PrivateCompanyInvites company={company} />
    ) : (
      <p className="company-invite-hint">
        Закрытая компания. За приглашением обратитесь к организатору.
      </p>
    )
  return (
    <div className="company-invite-share">
      <button
        type="button"
        className="plans-button plans-button--secondary"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          setMessage("")
        }}
      >
        <LinkOutlined aria-hidden="true" />
        Пригласить по ссылке
      </button>
      {open && (
        <div className="company-invite-share-panel">
          <label>
            Ссылка на компанию
            <input
              aria-label={`Ссылка на компанию «${company.name}»`}
              readOnly
              value={url}
              onFocus={(event) => event.target.select()}
            />
          </label>
          <p>
            Свободное вступление или заявка — по правилам компании. Ссылка не
            даёт доступа к чату до вступления.
          </p>
          <div className="company-invite-share-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void copy()
              }}
            >
              <ContentCopyOutlined aria-hidden="true" />
              Скопировать
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void share()
              }}
            >
              <ShareOutlined aria-hidden="true" />
              Поделиться
            </button>
          </div>
          {message && <p role="status">{message}</p>}
        </div>
      )}
    </div>
  )
}
