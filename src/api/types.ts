export type DictionaryItem = { id: number; name: string; slug: string | null };

export type UserShort = {
  id: number;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
};

export type User = UserShort & {
  city: DictionaryItem | null;
  about: string | null;
  interests: DictionaryItem[];
  role: "user" | "admin";
  status: "active" | "banned";
  isProfileComplete: boolean;
  createdAt: string;
  gender: "male" | "female" | "other" | null;
  birthDate: string | null;
};

export type Event = {
  id: number;
  title: string;
  description: string | null;
  categoryId: number;
  cityId: number;
  startsAt: string;
  endsAt: string | null;
  locationName: string;
  address: string | null;
  location: {
    latitude: number;
    longitude: number;
    source: "manual" | "geocoded";
  } | null;
  imageUrl: string | null;
  status: "pending" | "active" | "rejected" | "blocked" | "completed";
  moderationReason: string | null;
  participantsCount: number;
  companiesCount: number;
  creator: UserShort;
  createdAt: string;
  updatedAt: string;
};

export type EventInput = {
  title: string;
  description: string | null;
  categoryId: number;
  cityId: number;
  startsAt: string;
  endsAt: string | null;
  locationName: string;
  address: string | null;
  location: Event["location"];
  imageUrl: string | null;
};

export type Company = {
  id: number;
  eventId: number;
  name: string;
  description: string | null;
  maxMembers: number;
  joinType: "open" | "request";
  rules: string | null;
  owner: UserShort;
  membersCount: number;
  status: "active" | "closed" | "blocked";
  createdAt: string;
  updatedAt: string;
  minAge: number | null;
  maxAge: number | null;
};

export type CompanyMessage = {
  id: number;
  companyId: number;
  author: UserShort;
  text: string;
  createdAt: string;
};

export type Application = {
  id: number;
  companyId: number;
  user: UserShort;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  resolutionReason: "COMPANY_BLOCKED" | "EVENT_COMPLETED" | "EVENT_DELETED" | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type Report = {
  id: number;
  targetType: "user" | "company" | "event";
  targetId: number;
  reason: string;
  description: string | null;
  author: UserShort;
  status: "pending" | "resolved" | "rejected";
  resolvedBy: UserShort | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type AdminDashboard = {
  usersTotal: number;
  activeEvents: number;
  pendingReports: number;
  newRegistrations30d: number;
};

export type Pagination = { page: number; limit: number; total: number; totalPages: number };
export type Paginated<T> = { items: T[]; pagination: Pagination };

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details: Record<string, unknown> = {},
    public requestId = crypto.randomUUID(),
  ) {
    super(message);
  }
}
