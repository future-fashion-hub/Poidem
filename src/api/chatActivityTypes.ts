import type { UserShort } from "./types"

export type ChatPollInput = {
  question: string
  options: string[]
  durationHours: 24 | 72 | 168
}
export type ChatPoll = {
  id: number
  companyId: number
  question: string
  options: {
    id: string
    label: string
    votes: number
  }[]
  votersCount: number
  selectedOptionId: string | null
  author: UserShort
  createdAt: string
  closesAt: string
  closed: boolean
}
export type StoredChatPoll = Omit<ChatPoll, "votersCount" | "selectedOptionId"> & {
  votesByUser: Record<string, string>
}
