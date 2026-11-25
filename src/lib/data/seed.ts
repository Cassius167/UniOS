/**
 * Demonstration data for a first-year UBCO engineering student.
 *
 * Everything created here is flagged `isDemo: true` and labelled in the UI.
 * None of these schedules, grades or deadlines are real. Dates are generated
 * relative to *today* so the dashboard is meaningful whenever it is opened.
 * Settings → Data → "Remove demo data" deletes all of it in one step.
 */
import { addDays, format, setHours, setMinutes, startOfDay, subDays } from "date-fns";
import type {
  AppData,
  Assessment,
  Assignment,
  CalendarEvent,
  Course,
  Note,
  Priority,
  Resource,
  Semester,
  StudySession,
  Subtask,
} from "../types";
import { uid } from "../ids";
import { emptyData } from "./defaults";

function semesterFor(today: Date): Semester {
  const y = today.getFullYear();
  const m = today.getMonth();
  if (m >= 8) return { id: uid("sem"), name: `Winter Semester ${y}`, startDate: `${y}-09-08`, endDate: `${y}-12-18` };
  if (m <= 3) return { id: uid("sem"), name: `Winter Semester ${y - 1} · Term 2`, startDate: `${y}-01-05`, endDate: `${y}-04-24` };
  return { id: uid("sem"), name: `Summer Session ${y}`, startDate: `${y}-05-11`, endDate: `${y}-08-14` };
}

export function buildDemoData(now: Date = new Date()): AppData {
  const data = emptyData();
  const ts = now.toISOString();
  const today = startOfDay(now);
  const sem = semesterFor(now);
  const at = (day: Date, h: number, m = 0) => setMinutes(setHours(day, h), m);

  data.settings.profile = {
    name: "Ethan",
    university: "University of British Columbia Okanagan (UBCO)",
    faculty: "Applied Science",
    program: "Bachelor of Applied Science – Engineering",
    yearOfStudy: "First Year",
    expectedGraduation: "April 2030",
  };
  data.settings.semesters = [sem];
  data.settings.currentSemesterId = sem.id;

  /* ───────── Courses ───────── */
  const course = (p: Pick<Course, "code" | "name" | "instructor" | "tone" | "description"> & Partial<Course>): Course => ({
    id: uid("crs"),
    semesterId: sem.id,
    officeHours: "",
    website: "",
    credits: 3,
    targetGrade: 80,
    dropRules: [],
    archived: false,
    isDemo: true,
    createdAt: ts,
    updatedAt: ts,
    ...p,
  });
  const c169 = course({
    code: "APSC 169",
    name: "Fundamentals of Sustainable Engineering Design",
    instructor: "Dr. A. Morgan (demo)",
    tone: "sage",
    description: "Design process, teamwork and sustainability in engineering practice. Sample course for demonstration.",
    officeHours: "Wed 14:00–15:30, EME 2nd floor (demo)",
    website: "https://canvas.ubc.ca",
  });
  const c171 = course({
    code: "APSC 171",
    name: "Engineering Calculus I",
    instructor: "Dr. R. Chen (demo)",
    tone: "navy",
    description: "Limits, derivatives and applications for engineers. Sample course for demonstration.",
    officeHours: "Mon 13:00–14:00 (demo)",
    website: "https://canvas.ubc.ca",
    dropRules: [{ category: "Quizzes", dropLowest: 1 }],
  });
  const c176 = course({
    code: "APSC 176",
    name: "Engineering Communication",
    instructor: "Prof. L. Singh (demo)",
    tone: "terra",
    description: "Technical writing, presentation and documentation. Sample course for demonstration.",
    officeHours: "Thu 11:00–12:00 (demo)",
    website: "https://canvas.ubc.ca",
  });
  const c121 = course({
    code: "CHEM 121",
    name: "General Chemistry I",
    instructor: "Dr. P. Okafor (demo)",
    tone: "ochre",
    description: "Atomic structure, bonding and stoichiometry. Sample course for demonstration.",
    website: "https://canvas.ubc.ca",
  });
  const c178 = course({
    code: "APSC 178",
    name: "Electricity, Magnetism and Waves",
    instructor: "Dr. K. Laurent (demo)",
    tone: "slate",
    description: "Introductory electromagnetism and wave behaviour. Sample course for demonstration.",
  });
  data.courses = [c169, c171, c176, c121, c178];

  /* ───────── Weekly schedule (recurring events) ───────── */
  const semStart = new Date(`${sem.startDate}T00:00:00`);
  const firstOnOrAfter = (weekday: number) => {
    let d = semStart;
    while (d.getDay() !== weekday) d = addDays(d, 1);
    return d;
  };
  const weekly = (
    c: Course | null,
    title: string,
    type: CalendarEvent["type"],
    days: number[],
    h: number,
    m: number,
    durMin: number,
    location: string,
  ): CalendarEvent => {
    const first = at(firstOnOrAfter(Math.min(...days)), h, m);
    return {
      id: uid("evt"),
      title,
      type,
      courseId: c?.id ?? null,
      start: first.toISOString(),
      end: new Date(first.getTime() + durMin * 60_000).toISOString(),
      allDay: false,
      location,
      description: "",
      recurrence: { freq: "weekly", interval: 1, byWeekday: days, until: sem.endDate },
      exceptions: [],
      reminderMinutes: 10,
      source: "local",
      externalId: null,
      isDemo: true,
      createdAt: ts,
      updatedAt: ts,
    };
  };
  const oneOff = (
    c: Course | null,
    title: string,
    type: CalendarEvent["type"],
    day: Date,
    h: number,
    m: number,
    durMin: number,
    location = "",
    description = "",
  ): CalendarEvent => {
    const s = at(day, h, m);
    return {
      id: uid("evt"),
      title,
      type,
      courseId: c?.id ?? null,
      start: s.toISOString(),
      end: new Date(s.getTime() + durMin * 60_000).toISOString(),
      allDay: false,
      location,
      description,
      recurrence: null,
      exceptions: [],
      reminderMinutes: 30,
      source: "local",
      externalId: null,
      isDemo: true,
      createdAt: ts,
      updatedAt: ts,
    };
  };

  data.events = [
    weekly(c171, "APSC 171 Lecture", "lecture", [1, 3, 5], 9, 30, 60, "EME 1101 (demo)"),
    weekly(c169, "APSC 169 Lecture", "lecture", [2, 4], 11, 0, 80, "EME 0050 (demo)"),
    weekly(c176, "APSC 176 Lecture", "lecture", [1, 3], 13, 0, 80, "ASC 140 (demo)"),
    weekly(c121, "CHEM 121 Lecture", "lecture", [2, 4], 14, 0, 80, "SCI 333 (demo)"),
    weekly(c178, "APSC 178 Lecture", "lecture", [1, 5], 15, 30, 60, "EME 1121 (demo)"),
    weekly(c121, "CHEM 121 Lab", "lab", [3], 15, 30, 180, "SCI 232 (demo)"),
    weekly(c171, "APSC 171 Tutorial", "tutorial", [4], 16, 0, 50, "EME 1153 (demo)"),
    oneOff(null, "Focused study block", "study", today, 19, 0, 90, "Library, 3rd floor", "Planned study session (demo)."),
    oneOff(c169, "Design team meeting", "meeting", today, 17, 0, 45, "EME study room (demo)"),
    oneOff(c171, "Calculus review session", "study", addDays(today, 1), 18, 0, 60, "Library"),
    oneOff(c171, "APSC 171 Final Exam", "exam", addDays(today, 18), 9, 0, 150, "Gym (demo)"),
    oneOff(c121, "CHEM 121 Final Exam", "exam", addDays(today, 21), 14, 0, 150, "Gym (demo)"),
    oneOff(null, "Gym", "personal", addDays(today, 2), 7, 0, 60, "Hangar"),
  ];

  /* ───────── Assignments ───────── */
  const sub = (title: string, done: boolean, estimatedMinutes: number | null = null, priority: Priority = "medium"): Subtask => ({
    id: uid("sub"),
    title,
    done,
    dueDate: null,
    priority,
    estimatedMinutes,
  });
  const assignment = (p: Partial<Assignment> & Pick<Assignment, "title" | "courseId" | "dueAt" | "type">): Assignment => ({
    id: uid("asg"),
    description: "",
    estimatedHours: null,
    priority: "medium",
    gradeWeight: null,
    status: "not_started",
    submission: "not_submitted",
    subtasks: [],
    completedAt: null,
    isDemo: true,
    createdAt: ts,
    updatedAt: ts,
    ...p,
  });

  const report = assignment({
    title: "Sustainable Engineering Research Report",
    courseId: c169.id,
    type: "report",
    dueAt: at(addDays(today, 4), 23, 59).toISOString(),
    description: "Individual research report on a sustainable design case study, 2,500 words. (demo)",
    estimatedHours: 14,
    priority: "high",
    gradeWeight: 20,
    status: "in_progress",
    subtasks: [
      sub("Understand assignment requirements", true, 30),
      sub("Conduct research", true, 180),
      sub("Find academic sources", true, 90),
      sub("Evaluate sources", false, 60),
      sub("Create outline", false, 45),
      sub("Write first draft", false, 300, "high"),
      sub("Revise and edit", false, 120),
      sub("Complete references", false, 45),
      sub("Final review", false, 30),
      sub("Submit", false, 5, "high"),
    ],
  });

  data.assignments = [
    report,
    assignment({
      title: "Problem Set 9: Optimisation",
      courseId: c171.id,
      type: "homework",
      dueAt: at(addDays(today, 1), 23, 0).toISOString(),
      estimatedHours: 4,
      priority: "high",
      gradeWeight: 1.5,
      status: "in_progress",
      subtasks: [sub("Questions 1–4", true, 60), sub("Questions 5–8", false, 90), sub("Check answers", false, 30)],
    }),
    assignment({
      title: "Lab 8 report: Titration",
      courseId: c121.id,
      type: "lab",
      dueAt: at(addDays(today, 2), 17, 0).toISOString(),
      estimatedHours: 3,
      priority: "medium",
      gradeWeight: 2.5,
    }),
    assignment({
      title: "Technical memo draft",
      courseId: c176.id,
      type: "essay",
      dueAt: at(subDays(today, 1), 23, 59).toISOString(),
      estimatedHours: 2,
      priority: "medium",
      gradeWeight: 5,
    }),
    assignment({
      title: "Final design presentation",
      courseId: c169.id,
      type: "presentation",
      dueAt: at(addDays(today, 9), 11, 0).toISOString(),
      estimatedHours: 8,
      priority: "medium",
      gradeWeight: 15,
      subtasks: [sub("Slides outline", false, 60), sub("Rehearse with team", false, 90)],
    }),
    assignment({
      title: "Online quiz 10",
      courseId: c171.id,
      type: "quiz",
      dueAt: at(addDays(today, 6), 22, 0).toISOString(),
      estimatedHours: 1,
      priority: "low",
      gradeWeight: 1,
    }),
    assignment({
      title: "Waves problem set",
      courseId: c178.id,
      type: "homework",
      dueAt: at(addDays(today, 12), 23, 59).toISOString(),
      estimatedHours: 5,
      priority: "low",
    }),
    assignment({
      title: "Problem Set 8: Related rates",
      courseId: c171.id,
      type: "homework",
      dueAt: at(subDays(today, 6), 23, 0).toISOString(),
      estimatedHours: 4,
      status: "completed",
      submission: "graded",
      completedAt: at(subDays(today, 7), 20, 0).toISOString(),
    }),
    assignment({
      title: "Lab 7 report: Calorimetry",
      courseId: c121.id,
      type: "lab",
      dueAt: at(subDays(today, 5), 17, 0).toISOString(),
      estimatedHours: 3,
      status: "completed",
      submission: "submitted",
      completedAt: at(subDays(today, 5), 12, 0).toISOString(),
    }),
    assignment({
      title: "Peer review: memo outlines",
      courseId: c176.id,
      type: "other",
      dueAt: at(subDays(today, 3), 12, 0).toISOString(),
      estimatedHours: 1,
      status: "completed",
      submission: "submitted",
      completedAt: at(subDays(today, 3), 10, 0).toISOString(),
    }),
  ];

  /* ───────── Grades ───────── */
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  const asm = (c: Course, name: string, category: string, weight: number, score: number | null, maxScore = 100, daysAgo: number | null = null): Assessment => ({
    id: uid("asm"),
    courseId: c.id,
    name,
    category,
    weight,
    score,
    maxScore,
    date: daysAgo === null ? null : iso(subDays(today, daysAgo)),
    isBonus: false,
    excused: false,
    isDemo: true,
    createdAt: ts,
    updatedAt: ts,
  });

  data.assessments = [
    // APSC 171 — quizzes with drop-lowest, two midterms, final
    asm(c171, "Quiz 1", "Quizzes", 2, 8, 10, 70),
    asm(c171, "Quiz 2", "Quizzes", 2, 6, 10, 56),
    asm(c171, "Quiz 3", "Quizzes", 2, 9, 10, 42),
    asm(c171, "Quiz 4", "Quizzes", 2, 7, 10, 28),
    asm(c171, "Quiz 5", "Quizzes", 2, null),
    asm(c171, "Problem sets", "Homework", 10, 86, 100, 7),
    asm(c171, "Midterm 1", "Midterms", 15, 61, 80, 49),
    asm(c171, "Midterm 2", "Midterms", 20, 52, 75, 14),
    asm(c171, "Final Exam", "Final", 45, null),
    // APSC 169 — matches the spec example breakdown loosely
    asm(c169, "Design journal", "Assignments", 10, 88, 100, 30),
    asm(c169, "Team charter", "Assignments", 5, 18, 20, 60),
    asm(c169, "Midterm", "Midterms", 20, 74, 100, 35),
    asm(c169, "Research report", "Assignments", 20, null),
    asm(c169, "Final design presentation", "Project", 15, null),
    asm(c169, "Final exam", "Final", 30, null),
    // APSC 176
    asm(c176, "Writing diagnostic", "Assignments", 5, 82, 100, 75),
    asm(c176, "Technical description", "Assignments", 15, 39, 50, 40),
    asm(c176, "Oral briefing", "Presentations", 15, 84, 100, 20),
    asm(c176, "Technical memo", "Assignments", 25, null),
    asm(c176, "Final portfolio", "Final", 40, null),
    // CHEM 121
    asm(c121, "Labs (to date)", "Labs", 20, 81, 100, 5),
    asm(c121, "Midterm", "Midterms", 30, 66, 100, 33),
    asm(c121, "Online homework", "Homework", 10, 93, 100, 2),
    asm(c121, "Final Exam", "Final", 40, null),
  ];
  data.assessments.push({ ...asm(c121, "Participation bonus", "Bonus", 2, 2, 2, 10), isBonus: true });
  // APSC 178 intentionally has no grades yet, to show the empty state.

  /* ───────── Study sessions (past 3 weeks) ───────── */
  const ratings = [4, 3, 5, 4, 2, 4, 3, 5, 4, 3];
  const sessionCourses = [c171, c169, c121, c176, c171, c178, c169, c171, c121];
  const sessions: StudySession[] = [];
  for (let d = 20; d >= 1; d--) {
    if (d % 3 === 0) continue; // a few rest days
    const count = d % 4 === 0 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const c = sessionCourses[(d + i) % sessionCourses.length];
      const kind = (d + i) % 3 === 0 ? "deep" : "pomodoro";
      const planned = kind === "deep" ? 50 : 25;
      const actual = Math.max(10, planned - ((d * 7 + i * 3) % 9));
      const start = at(subDays(today, d), 10 + i * 5 + (d % 4), 0);
      sessions.push({
        id: uid("ses"),
        courseId: c.id,
        assignmentId: null,
        task: c.code === "APSC 171" ? "Practice problems" : "Readings and review",
        kind,
        startedAt: start.toISOString(),
        plannedMinutes: planned,
        actualMinutes: actual,
        rating: ratings[(d + i) % ratings.length],
        reflection: "",
        distractions:
          d % 5 === 0
            ? [{ id: uid("dis"), kind: "phone", at: start.toISOString(), note: "" }]
            : d % 7 === 0
              ? [{ id: uid("dis"), kind: "websites", at: start.toISOString(), note: "" }]
              : [],
        isDemo: true,
        createdAt: ts,
      });
    }
  }
  data.sessions = sessions;

  /* ───────── Notes & resources ───────── */
  const folderId = uid("fld");
  data.folders = [{ id: folderId, name: "Exam prep", createdAt: ts }];
  const note = (p: Partial<Note> & Pick<Note, "title" | "content">): Note => ({
    id: uid("nte"),
    courseId: null,
    folderId: null,
    tags: [],
    starred: false,
    isDemo: true,
    createdAt: ts,
    updatedAt: ts,
    ...p,
  });
  data.notes = [
    note({
      title: "Optimisation problem checklist",
      courseId: c171.id,
      folderId,
      tags: ["calculus", "method"],
      starred: true,
      content:
        "<h2>Approach</h2><ol><li>Draw and label a diagram.</li><li>Write the quantity to optimise as a function of one variable.</li><li>Find the domain.</li><li>Differentiate, solve f′(x) = 0.</li><li>Check endpoints and critical points.</li></ol><ul data-checklist><li data-checked=\"true\">Review textbook §4.7</li><li data-checked=\"false\">Do 10 practice problems</li></ul>",
    }),
    note({
      title: "Report structure ideas",
      courseId: c169.id,
      tags: ["writing"],
      content:
        "<p>Case study candidates: district energy, low-carbon concrete, stormwater bioswales.</p><ul><li>Intro and scope</li><li>Lifecycle analysis</li><li>Trade-offs and recommendation</li></ul>",
    }),
    note({
      title: "Weekly reflection",
      tags: ["personal"],
      content: "<p>Calculus quizzes are going better when I do practice problems the same day as the lecture.</p>",
    }),
  ];
  const resource = (p: Partial<Resource> & Pick<Resource, "title" | "kind">): Resource => ({
    id: uid("res"),
    courseId: null,
    category: "General",
    url: null,
    fileKey: null,
    fileName: null,
    fileSize: null,
    mimeType: null,
    description: "",
    isDemo: true,
    createdAt: ts,
    ...p,
  });
  data.resources = [
    resource({ title: "Canvas course page", kind: "link", courseId: c171.id, category: "Course site", url: "https://canvas.ubc.ca" }),
    resource({ title: "Paul's Online Math Notes: Optimisation", kind: "link", courseId: c171.id, category: "Readings", url: "https://tutorial.math.lamar.edu/Classes/CalcI/Optimization.aspx" }),
    resource({ title: "UBC Library: engineering databases", kind: "link", courseId: c169.id, category: "Research", url: "https://guides.library.ubc.ca" }),
  ];

  return data;
}
