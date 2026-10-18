import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

function harness(saved = null) {
  let snapshot = saved,
    full = false
  const cache = new Map()
  const load = (path) => {
    if (cache.has(path)) return cache.get(path)
    const exports = {}
    cache.set(path, exports)
    const code = ts.transpileModule(
      readFileSync(new URL(path, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    ).outputText
    new Function("require", "exports", "localStorage", "setTimeout", code)(
      (name) => load(`${name}.ts`),
      exports,
      {
        getItem: () => snapshot,
        setItem: (_key, value) => {
          if (full) throw new Error("Quota")
          snapshot = value
        },
      },
      (callback) => {
        callback()
        return 1
      },
    )
    return exports
  }
  return {
    api: load("./mockApi.ts").mockApi,
    helpers: load("./chatPolls.ts"),
    snapshot: () => snapshot,
    fill: () => {
      full = true
    },
  }
}
const input = {
  question: "Где встречаемся?",
  options: ["У входа", "Внутри"],
  durationHours: 24,
}
const companyInput = {
  name: "Наша компания",
  description: null,
  maxMembers: 5,
  joinType: "open",
}
async function setup() {
  const storage = harness()
  await storage.api.login("google")
  const company = await storage.api.createCompany(3001, companyInput)
  return { ...storage, company }
}
function switchUser(storage, id, alter = () => {}) {
  const saved = JSON.parse(storage.snapshot())
  saved.user = saved.users.find((user) => user.id === id)
  alter(saved)
  return harness(JSON.stringify(saved))
}

test("poll validation rejects duplicates, invalid duration, empty and oversized choices", () => {
  const { validateChatPoll } = harness().helpers
  assert.deepEqual(
    validateChatPoll({
      ...input,
      question: " Где встречаемся? ",
      options: [" У входа ", "Внутри"],
    }),
    input,
  )
  for (const patch of [
    { question: "Да" },
    { options: ["Да"] },
    { options: ["Да", " да "] },
    { options: ["", "Нет"] },
    { options: ["x".repeat(81), "Нет"] },
    { options: Array.from({ length: 7 }, (_, i) => String(i)) },
    { durationHours: 1 },
  ])
    assert.throws(
      () => validateChatPoll({ ...input, ...patch }),
      (error) => error.code === "VALIDATION_ERROR",
    )
})

test("single-choice votes can change and be removed, remain anonymous and survive reload", async () => {
  const storage = await setup(),
    id = storage.company.id
  const poll = await storage.api.createCompanyPoll(id, input)
  assert.equal(poll.votersCount, 0)
  assert.equal("votesByUser" in poll, false)
  await storage.api.voteCompanyPoll(id, poll.id, "1")
  await storage.api.voteCompanyPoll(id, poll.id, "1")
  let result = await storage.api.voteCompanyPoll(id, poll.id, "2")
  assert.equal(result.votersCount, 1)
  assert.deepEqual(
    result.options.map((option) => option.votes),
    [0, 1],
  )
  result = (await harness(storage.snapshot()).api.listCompanyPolls(id)).items[0]
  assert.equal(result.selectedOptionId, "2")
  const member = switchUser(storage, 3)
  await member.api.joinOpenCompany(id)
  result = await member.api.voteCompanyPoll(id, poll.id, "1")
  assert.equal(result.votersCount, 2)
  assert.equal(result.selectedOptionId, "1")
  const owner = switchUser(member, 1)
  result = await owner.api.voteCompanyPoll(id, poll.id, null)
  assert.equal(result.votersCount, 1)
  assert.equal(result.selectedOptionId, null)
  await assert.rejects(
    owner.api.voteCompanyPoll(id, poll.id, "bad"),
    (error) => error.code === "VALIDATION_ERROR",
  )
})

test("nonmembers and guests cannot read or mutate another company's activities", async () => {
  const storage = await setup(),
    id = storage.company.id,
    poll = await storage.api.createCompanyPoll(id, input)
  for (const userId of [3, 0]) {
    const outsider = switchUser(storage, userId).api
    for (const action of [
      () => outsider.listCompanyPolls(id),
      () => outsider.getCompanyPinnedMessage(id),
      () => outsider.createCompanyPoll(id, input),
      () => outsider.voteCompanyPoll(id, poll.id, "1"),
      () => outsider.setCompanyPinnedMessage(id, null),
    ])
      await assert.rejects(action(), (error) =>
        [401, 403].includes(error.status),
      )
  }
})

test("only poll author or company owner can close; closed and expired polls reject votes", async () => {
  const storage = await setup(),
    id = storage.company.id,
    poll = await storage.api.createCompanyPoll(id, input)
  const member = switchUser(storage, 3)
  await member.api.joinOpenCompany(id)
  await assert.rejects(
    member.api.closeCompanyPoll(id, poll.id),
    (error) => error.status === 403,
  )
  const ownPoll = await member.api.createCompanyPoll(id, input)
  assert.equal((await member.api.closeCompanyPoll(id, ownPoll.id)).closed, true)
  await assert.rejects(
    member.api.voteCompanyPoll(id, ownPoll.id, "1"),
    (error) => error.code === "POLL_CLOSED",
  )
  const owner = switchUser(member, 1)
  assert.equal((await owner.api.closeCompanyPoll(id, poll.id)).closed, true)
  const expired = switchUser(storage, 1, (saved) => {
    saved.chatPolls[id][0].closesAt = "2000-01-01T00:00:00Z"
  })
  assert.equal((await expired.api.listCompanyPolls(id)).items[0].closed, true)
  await assert.rejects(
    expired.api.voteCompanyPoll(id, poll.id, "1"),
    (error) => error.code === "POLL_CLOSED",
  )
})

test("pins persist with messages, stay scoped to company and only owner controls them", async () => {
  const storage = await setup(),
    id = storage.company.id
  const message = await storage.api.sendCompanyMessage(
    id,
    "Встречаемся у входа",
  )
  await storage.api.setCompanyPinnedMessage(id, message.id)
  const reload = harness(storage.snapshot())
  assert.equal(
    (await reload.api.getCompanyPinnedMessage(id)).text,
    message.text,
  )
  assert.equal(
    (await reload.api.listCompanyMessages(id)).items[0].id,
    message.id,
  )
  const second = await reload.api.createCompany(3002, companyInput)
  await assert.rejects(
    reload.api.setCompanyPinnedMessage(second.id, message.id),
    (error) => error.code === "MESSAGE_NOT_FOUND",
  )
  const member = switchUser(reload, 3)
  await member.api.joinOpenCompany(id)
  assert.equal((await member.api.getCompanyPinnedMessage(id)).id, message.id)
  await assert.rejects(
    member.api.setCompanyPinnedMessage(id, null),
    (error) => error.status === 403,
  )
  const owner = switchUser(member, 1)
  await owner.api.setCompanyPinnedMessage(id, null)
  assert.equal(await owner.api.getCompanyPinnedMessage(id), null)
})

test("ended/blocked events deny chat activity writes without erasing history", async () => {
  const storage = await setup(),
    id = storage.company.id,
    poll = await storage.api.createCompanyPoll(id, input)
  for (const change of [
    { endsAt: "2000-01-01T00:00:00Z" },
    { status: "blocked" },
  ]) {
    const altered = switchUser(storage, 1, (saved) =>
      Object.assign(
        saved.events.find((event) => event.id === 3001),
        change,
      ),
    )
    assert.equal((await altered.api.listCompanyPolls(id)).items.length, 1)
    for (const action of [
      () => altered.api.createCompanyPoll(id, input),
      () => altered.api.voteCompanyPoll(id, poll.id, "1"),
      () => altered.api.setCompanyPinnedMessage(id, null),
      () => altered.api.sendCompanyMessage(id, "Привет"),
    ])
      await assert.rejects(
        action(),
        (error) => error.code === "EVENT_UNAVAILABLE",
      )
  }
})

test("storage failures are atomic for votes, polls, pins and messages", async () => {
  const storage = await setup(),
    id = storage.company.id
  const poll = await storage.api.createCompanyPoll(id, input),
    message = await storage.api.sendCompanyMessage(id, "Привет")
  storage.fill()
  for (const action of [
    () => storage.api.voteCompanyPoll(id, poll.id, "1"),
    () => storage.api.createCompanyPoll(id, input),
    () => storage.api.setCompanyPinnedMessage(id, message.id),
    () => storage.api.sendCompanyMessage(id, "Ещё"),
  ])
    await assert.rejects(action(), (error) => error.code === "STORAGE_FULL")
  const items = (await storage.api.listCompanyPolls(id)).items
  assert.equal(items.length, 1)
  assert.equal(items[0].votersCount, 0)
  assert.equal(await storage.api.getCompanyPinnedMessage(id), null)
  assert.equal((await storage.api.listCompanyMessages(id)).items.length, 1)
})

test("poll pages cover histories beyond 100 and creation deadline does not exceed event end", async () => {
  const storage = await setup(),
    id = storage.company.id,
    poll = await storage.api.createCompanyPoll(id, {
      ...input,
      durationHours: 168,
    })
  const saved = JSON.parse(storage.snapshot()),
    event = saved.events.find((event) => event.id === 3001)
  assert.ok(
    Date.parse(poll.closesAt) <= Date.parse(event.endsAt || event.startsAt),
  )
  saved.chatPolls[id] = Array.from({ length: 125 }, (_, index) => ({
    ...saved.chatPolls[id][0],
    id: index + 1,
  }))
  const restored = harness(JSON.stringify(saved)),
    pages = await Promise.all(
      [1, 2, 3].map((page) =>
        restored.api.listCompanyPolls(id, { page, limit: 50 }),
      ),
    )
  assert.deepEqual(
    pages.map((page) => page.items.length),
    [50, 50, 25],
  )
  assert.equal(
    new Set(pages.flatMap((page) => page.items).map((poll) => poll.id)).size,
    125,
  )
})
