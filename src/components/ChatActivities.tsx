import { useRef, useState } from "react"
import type { FormEvent } from "react"
import PollOutlined from "@mui/icons-material/PollOutlined"
import AddRounded from "@mui/icons-material/AddRounded"
import CloseRounded from "@mui/icons-material/CloseRounded"
import CheckRounded from "@mui/icons-material/CheckRounded"
import { validateChatPoll } from "../api/chatPolls"
import type { Company } from "../api/types"
import type { ChatPollInput } from "../api/chatActivityTypes"
import type { useChatActivities } from "./useChatActivities"
import "./chatActivities.css"

type Activities = ReturnType<typeof useChatActivities>
export default function ChatActivities({
  company,
  userId,
  activities,
}: {
  company: Company
  userId: number
  activities: Activities
}) {
  const [creating, setCreating] = useState(false)
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [duration, setDuration] = useState<ChatPollInput["durationHours"]>(24)
  const [error, setError] = useState("")
  const errorRef = useRef<HTMLParagraphElement | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    let input: ChatPollInput
    try {
      input = validateChatPoll({ question, options, durationHours: duration })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Проверьте варианты ответа",
      )
      requestAnimationFrame(() => errorRef.current?.focus())
      return
    }
    if (await activities.create(input)) {
      setCreating(false)
      setQuestion("")
      setOptions(["", ""])
    }
  }
  return (
    <section
      className="chat-activities"
      id={`chat-polls-${company.id}`}
      aria-label="Опросы компании"
      aria-busy={activities.loading || activities.busy}
    >
      <div className="chat-activities-heading">
        <span className="chat-activities-icon">
          <PollOutlined aria-hidden="true" />
        </span>
        <div>
          <h3>Решаем вместе</h3>
          <p>Где встретиться и что выбрать — спросите компанию.</p>
        </div>
      </div>
      <button
        type="button"
        className="chat-activity-action is-primary"
        aria-expanded={creating}
        onClick={() => setCreating((value) => !value)}
        disabled={activities.busy}
      >
        <AddRounded aria-hidden="true" />
        {creating ? "Свернуть форму" : "Создать опрос"}
      </button>
      {creating && (
        <form className="chat-poll-form" onSubmit={submit}>
          <label htmlFor="chat-poll-question">
            Ваш вопрос
            <input
              autoFocus
              id="chat-poll-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              minLength={5}
              maxLength={160}
              required
              disabled={activities.busy}
            />
          </label>
          <fieldset disabled={activities.busy}>
            <legend>Варианты ответа · от 2 до 6</legend>
            {options.map((option, index) => (
              <div className="chat-poll-input-row" key={index}>
                <label htmlFor={`chat-option-${index}`}>
                  <span className="sr-only">Вариант {index + 1}</span>
                  <input
                    id={`chat-option-${index}`}
                    value={option}
                    onChange={(event) =>
                      setOptions((values) =>
                        values.map((value, position) =>
                          position === index ? event.target.value : value,
                        ),
                      )
                    }
                    maxLength={80}
                    required
                    placeholder={`Вариант ${index + 1}`}
                  />
                </label>
                {options.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Удалить вариант ${index + 1}`}
                    onClick={() =>
                      setOptions((values) =>
                        values.filter((_, position) => position !== index),
                      )
                    }
                  >
                    <CloseRounded aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button
                type="button"
                className="chat-activity-action"
                onClick={() => setOptions((values) => [...values, ""])}
              >
                <AddRounded aria-hidden="true" />
                Добавить вариант
              </button>
            )}
          </fieldset>
          <label htmlFor="chat-poll-duration">
            Завершить через
            <select
              id="chat-poll-duration"
              value={duration}
              disabled={activities.busy}
              onChange={(event) =>
                setDuration(
                  Number(event.target.value) as ChatPollInput["durationHours"],
                )
              }
            >
              <option value={24}>1 день</option>
              <option value={72}>3 дня</option>
              <option value={168}>Неделю</option>
            </select>
          </label>
          <p className="chat-activity-note">
            Один голос, который можно изменить. Имена голосующих не
            показываются. Опрос завершится не позднее окончания встречи.
          </p>
          {error && (
            <p className="chat-error" role="alert" tabIndex={-1} ref={errorRef}>
              {error}
            </p>
          )}
          <button
            type="submit"
            className="chat-activity-action is-primary"
            disabled={activities.busy}
          >
            {activities.busy ? "Сохраняем…" : "Опубликовать опрос"}
          </button>
        </form>
      )}
      {activities.loading && <p role="status">Загружаем опросы…</p>}
      {!activities.loading && !activities.polls.length && !activities.error && (
        <p className="chat-activity-note">
          Пока нет опросов. Предложите компании первый выбор.
        </p>
      )}
      {activities.polls.map((poll) => {
        const closed = poll.closed || Date.parse(poll.closesAt) <= Date.now()
        return (
          <article
            className="chat-poll"
            key={poll.id}
            aria-label={poll.question}
          >
            <div className="chat-poll-meta">
              <span>{closed ? "Завершён" : "Опрос"}</span>
              <span>{poll.author.firstName}</span>
            </div>
            <h4>{poll.question}</h4>
            <div className="chat-poll-options">
              {poll.options.map((option) => {
                const chosen = poll.selectedOptionId === option.id,
                  percent = poll.votersCount
                    ? Math.round((option.votes / poll.votersCount) * 100)
                    : 0
                return (
                  <button
                    type="button"
                    key={option.id}
                    className="chat-poll-option"
                    aria-pressed={chosen}
                    disabled={closed || activities.busy}
                    onClick={() => void activities.vote(poll.id, option.id)}
                  >
                    <span
                      className="chat-poll-bar"
                      style={{ transform: `scaleX(${percent / 100})` }}
                      aria-hidden="true"
                    />
                    <span className="chat-poll-option-label">
                      {chosen && <CheckRounded aria-hidden="true" />}
                      {option.label}
                    </span>
                    <span className="chat-poll-percent">
                      {percent}%{" "}
                      <span className="sr-only">· голосов: {option.votes}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="chat-activity-note">
              Голосов: {poll.votersCount} ·{" "}
              {closed
                ? "Голосование завершено"
                : `До ${new Date(poll.closesAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
            </p>
            <div className="chat-poll-actions">
              {!closed && poll.selectedOptionId && (
                <button
                  type="button"
                  className="chat-activity-action"
                  disabled={activities.busy}
                  onClick={() => void activities.vote(poll.id, null)}
                >
                  Отозвать голос
                </button>
              )}
              {!closed &&
                (poll.author.id === userId || company.owner.id === userId) && (
                  <button
                    type="button"
                    className="chat-activity-action"
                    disabled={activities.busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Завершить опрос? Новые голоса больше не будут приниматься.",
                        )
                      )
                        void activities.close(poll.id)
                    }}
                  >
                    Завершить опрос
                  </button>
                )}
            </div>
          </article>
        )
      })}
    </section>
  )
}
