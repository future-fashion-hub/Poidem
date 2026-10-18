import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "../api"
import { collectPages } from "../api/pagination"
import type { ChatPoll, ChatPollInput } from "../api/chatActivityTypes"
import type { CompanyMessage } from "../api/types"

export function useChatActivities(companyId: number | null, userId: number) {
  const key = `${userId}:${companyId}`
  const identity = useRef(key)
  identity.current = key
  const reads = useRef(0)
  const writing = useRef(new Set<string>())
  const [data, setData] = useState<{
    key: string
    polls: ChatPoll[]
    pinned: CompanyMessage | null
  }>({ key, polls: [], pinned: null })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    if (companyId === null || writing.current.has(key)) return
    const version = ++reads.current
    try {
      const [result, pinned] = await Promise.all([
        collectPages(
          (options) => api.listCompanyPolls(companyId, options),
          30,
          true,
        ),
        api.getCompanyPinnedMessage(companyId),
      ])
      if (identity.current !== key || version !== reads.current) return
      setData({ key, polls: result.items, pinned })
      setError("")
    } catch (caught) {
      if (identity.current === key && version === reads.current)
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось обновить опросы и закрепление",
        )
    } finally {
      if (identity.current === key && version === reads.current)
        setLoading(false)
    }
  }, [companyId, key])

  useEffect(() => {
    setData({ key, polls: [], pinned: null })
    setError("")
    setBusy(writing.current.has(key))
    setLoading(companyId !== null)
    void refresh()
    const update = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const timer = window.setInterval(update, 30000)
    window.addEventListener("focus", update)
    return () => {
      ++reads.current
      window.clearInterval(timer)
      window.removeEventListener("focus", update)
    }
  }, [key, refresh])

  const mutate = async <T,>(
    action: () => Promise<T>,
    apply: (value: T) => void,
  ) => {
    if (companyId === null || writing.current.has(key)) return false
    writing.current.add(key)
    ++reads.current
    setBusy(true)
    setError("")
    try {
      const value = await action()
      if (identity.current === key) {
        apply(value)
        setLoading(false)
      }
      return true
    } catch (caught) {
      if (identity.current === key)
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось сохранить изменения",
        )
      return false
    } finally {
      writing.current.delete(key)
      if (identity.current === key) {
        setBusy(false)
        setLoading(false)
      }
    }
  }
  const acceptPoll = (poll: ChatPoll) =>
    setData((previous) => {
      const polls = previous.key === key ? previous.polls : []
      return {
        key,
        pinned: previous.key === key ? previous.pinned : null,
        polls: polls.some((item) => item.id === poll.id)
          ? polls.map((item) => (item.id === poll.id ? poll : item))
          : [poll, ...polls],
      }
    })
  return {
    polls: data.key === key ? data.polls : [],
    pinned: data.key === key ? data.pinned : null,
    loading,
    busy,
    error,
    refresh,
    create: (input: ChatPollInput) =>
      mutate(() => api.createCompanyPoll(companyId!, input), acceptPoll),
    vote: (pollId: number, optionId: string | null) =>
      mutate(
        () => api.voteCompanyPoll(companyId!, pollId, optionId),
        acceptPoll,
      ),
    close: (pollId: number) =>
      mutate(() => api.closeCompanyPoll(companyId!, pollId), acceptPoll),
    pin: (messageId: number | null) =>
      mutate(
        () => api.setCompanyPinnedMessage(companyId!, messageId),
        (pinned) =>
          setData((previous) => ({
            key,
            polls: previous.key === key ? previous.polls : [],
            pinned,
          })),
      ),
  }
}
