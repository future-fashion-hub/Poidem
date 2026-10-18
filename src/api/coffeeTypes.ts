import type { Company, Event } from "./types";

export type CoffeeTopic = "chat" | "work" | "walk";
export type CoffeeParticipation = "none" | "owner" | "member" | "pending";
export type CoffeeRecord = { id: number; eventId: number; companyId: number; topic: CoffeeTopic };
export type CoffeeMeeting = CoffeeRecord & { event: Event; company: Company; participation: CoffeeParticipation };
export type CoffeeFilters = { cityId?: number; topic?: CoffeeTopic };
export type CoffeeInput = {
  title: string; description: string; cityId: number; locationName: string; address: string;
  startsAt: string; duration: number; maxMembers: number; joinType: "open" | "request"; topic: CoffeeTopic;
};
