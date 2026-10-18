import { ApiError } from "./types"
import type {
  ChatPoll,
  ChatPollInput,
  StoredChatPoll,
} from "./chatActivityTypes"

export function validateChatPoll(input: ChatPollInput): ChatPollInput {
  const question = input.question?.trim() ?? ""
  const options = Array.isArray(input.options)
    ? input.options.map((value) =>
        typeof value === "string" ? value.trim() : "",
      )
    : []
  if (question.length < 5 || question.length > 160)
    throw new ApiError(
      "VALIDATION_ERROR",
      "Вопрос должен содержать от 5 до 160 символов",
      400,
    )
  if (
    options.length < 2 ||
    options.length > 6 ||
    options.some((value) => !value || value.length > 80)
  )
    throw new ApiError(
      "VALIDATION_ERROR",
      "Добавьте от 2 до 6 вариантов ответа, до 80 символов каждый",
      400,
    )
  if (
    new Set(options.map((value) => value.toLocaleLowerCase("ru-RU"))).size !==
    options.length
  )
    throw new ApiError(
      "VALIDATION_ERROR",
      "Варианты ответа не должны повторяться",
      400,
    )
  if (![24, 72, 168].includes(input.durationHours))
    throw new ApiError(
      "VALIDATION_ERROR",
      "Выберите срок опроса: день, три дня или неделя",
      400,
    )
  return { question, options, durationHours: input.durationHours }
}

export function chatPollView(
  poll: StoredChatPoll,
  userId: number,
  now = Date.now(),
): ChatPoll {
  const { votesByUser, ...publicPoll } = poll
  const votes = Object.values(votesByUser).filter((id) =>
    poll.options.some((option) => option.id === id),
  )
  return {
    ...publicPoll,
    options: poll.options.map((option) => ({
      ...option,
      votes: votes.filter((id) => id === option.id).length,
    })),
    votersCount: votes.length,
    selectedOptionId: votesByUser[userId] ?? null,
    closed: poll.closed || Date.parse(poll.closesAt) <= now,
  }
}
