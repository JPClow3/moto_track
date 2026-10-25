import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  nextScheduleMilestone,
} from "$server/domain/maintenance-schedule";
import { dueStateForPlan } from "$server/domain/motorcycle-catalog";
import {
  snoozeDateTarget,
  snoozeKmTarget,
} from "$server/domain/reminder-lifecycle";

const rule = {
  milestones: [
    { km: 1000, months: 6 },
    { km: 3000, months: 12 },
  ],
  recurrenceKm: 3000,
  recurrenceMonths: 6,
  inServiceDate: "2025-01-31",
};

describe("manufacturer review phases", () => {
  it("restarts replacement age at the confirmed replacement date", () => {
    const replacement = {
      milestones: [{ km: null, months: 36 }],
      recurrenceKm: null,
      recurrenceMonths: 36,
      inServiceDate: "2025-01-31",
      calendarAnchorMode: "last_service" as const,
    };
    expect(
      nextScheduleMilestone({ ...replacement, completedMilestone: 0 }),
    ).toMatchObject({ dueDate: "2028-01-31" });
    expect(
      nextScheduleMilestone({
        ...replacement,
        completedMilestone: 1,
        lastServiceDate: "2026-02-28",
      }),
    ).toMatchObject({ dueDate: "2029-02-28" });
    expect(
      nextScheduleMilestone({ ...replacement, completedMilestone: 1 }),
    ).toMatchObject({ dueDate: null });
  });
  it("keeps the first and second irregular mileage stages before recurrence", () => {
    expect(
      nextScheduleMilestone({ ...rule, completedMilestone: 0 }),
    ).toMatchObject({ nextMilestone: 1, dueKm: 1000, dueDate: "2025-07-31" });
    expect(
      nextScheduleMilestone({ ...rule, completedMilestone: 1 }),
    ).toMatchObject({ nextMilestone: 2, dueKm: 3000, dueDate: "2026-01-31" });
    expect(
      nextScheduleMilestone({ ...rule, completedMilestone: 2 }),
    ).toMatchObject({ nextMilestone: 3, dueKm: 6000, dueDate: "2026-07-31" });
    expect(
      nextScheduleMilestone({ ...rule, completedMilestone: 3 }),
    ).toMatchObject({ nextMilestone: 4, dueKm: 9000, dueDate: "2027-01-31" });
  });

  it("does not infer a phase or original invoice date for used motorcycles", () => {
    expect(
      nextScheduleMilestone({ ...rule, completedMilestone: null }),
    ).toEqual({
      nextMilestone: null,
      dueKm: null,
      dueMonths: null,
      dueDate: null,
    });
    expect(
      nextScheduleMilestone({
        ...rule,
        inServiceDate: null,
        completedMilestone: 1,
      }),
    ).toMatchObject({ nextMilestone: 2, dueKm: 3000, dueDate: null });
  });

  it("advances an explicitly completed early review without inferring stage from mileage", () => {
    const state = dueStateForPlan({
      historyStatus: "confirmed_done",
      lastDoneKm: 200,
      intervalKm: 3000,
      currentKm: 300,
      intervalDays: 180,
      lastDoneDate: "2025-07-31",
      scheduleMilestones: rule.milestones,
      recurrenceKm: 3000,
      recurrenceMonths: 6,
      lastCompletedMilestone: 1,
      inServiceDate: rule.inServiceDate,
      today: "2025-08-01",
    });
    expect(state).toEqual({ urgency: "scheduled", dueKm: 3000 });
    expect(
      dueStateForPlan({
        historyStatus: "not_done",
        lastDoneKm: null,
        intervalKm: 3000,
        currentKm: 300,
        scheduleMilestones: rule.milestones,
        recurrenceKm: 3000,
        recurrenceMonths: 6,
        lastCompletedMilestone: 0,
        inServiceDate: rule.inServiceDate,
        today: "2025-03-01",
      }),
    ).toEqual({ urgency: "scheduled", dueKm: 1000 });
  });

  it("uses calendar months and actual original age instead of 180-day approximations", () => {
    expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addCalendarMonths("2025-01-31", 1)).toBe("2025-02-28");
    expect(addCalendarMonths("2026-02-30", 6)).toBeNull();
    expect(
      dueStateForPlan({
        historyStatus: "confirmed_done",
        lastDoneKm: 200,
        intervalKm: 3000,
        currentKm: 300,
        scheduleMilestones: rule.milestones,
        recurrenceKm: 3000,
        recurrenceMonths: 6,
        lastCompletedMilestone: 1,
        inServiceDate: rule.inServiceDate,
        today: "2026-01-31",
      }),
    ).toEqual({ urgency: "overdue", dueKm: 3000 });
  });
});

describe("reminder deferral targets", () => {
  it("adds only the chosen deferral to today or current mileage", () => {
    expect(snoozeDateTarget("2026-10-23", 7)).toBe("2026-10-30");
    expect(snoozeKmTarget(12000, 500)).toBe(12500);
  });
  it("refuses nonfinite, fractional, negative and overflowing deferrals", () => {
    for (const days of [NaN, Infinity, -1, 0, 0.5, 366])
      expect(() => snoozeDateTarget("2026-10-23", days)).toThrow();
    for (const km of [NaN, Infinity, -1, 0, 0.5])
      expect(() => snoozeKmTarget(12000, km)).toThrow();
    expect(() => snoozeKmTarget(2147483647, 500)).toThrow();
  });
});
