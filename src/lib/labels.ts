import type {
  AssignmentStatus,
  AssignmentType,
  CourseTone,
  DistractionKind,
  EventType,
  Priority,
  ResourceKind,
  SessionKind,
  SubmissionStatus,
} from "./types";

/** Muted course tints. Same hue works on ivory and on dark navy. */
export const TONES: Record<CourseTone, string> = {
  sage: "#879486",
  terra: "#b87961",
  navy: "#4a5d6b",
  ochre: "#b39a5f",
  slate: "#7d8a99",
  moss: "#6f7d5c",
  clay: "#a0806e",
  stone: "#9a968b",
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  lecture: "Lecture",
  lab: "Lab",
  tutorial: "Tutorial",
  exam: "Exam",
  deadline: "Deadline",
  study: "Study session",
  personal: "Personal",
  meeting: "Meeting",
};

/** Restrained per-type marks: used as a left rule colour when no course tint applies. */
export const EVENT_TYPE_TONE: Record<EventType, string> = {
  lecture: "#4a5d6b",
  lab: "#7d8a99",
  tutorial: "#9a968b",
  exam: "#b87961",
  deadline: "#b87961",
  study: "#879486",
  personal: "#b39a5f",
  meeting: "#a0806e",
};

export const ASSIGNMENT_TYPE_LABEL: Record<AssignmentType, string> = {
  homework: "Homework",
  lab: "Lab",
  project: "Project",
  essay: "Essay",
  report: "Research report",
  presentation: "Presentation",
  quiz: "Quiz",
  exam: "Exam",
  other: "Other",
};

export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  not_submitted: "Not submitted",
  submitted: "Submitted",
  graded: "Graded",
};

export const SESSION_KIND_LABEL: Record<SessionKind, string> = { pomodoro: "Pomodoro", deep: "Deep focus", custom: "Custom" };

export const DISTRACTION_LABEL: Record<DistractionKind, string> = {
  phone: "Phone",
  websites: "Other websites",
  unrelated: "Unrelated task",
  focus: "Lost focus",
  other: "Other",
};

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  link: "Link",
  pdf: "PDF",
  document: "Document",
  slides: "Lecture slides",
  image: "Image",
  other: "File",
};
