export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "in2peta_token";

// ---------- Types (mirror docs/API_CONTRACT.md exactly) ----------

export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
  auth_provider: "email" | "google";
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export type CourseStatus = "generating" | "ready" | "failed";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface CourseSummary {
  id: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  estimated_minutes: number;
  status: CourseStatus;
  created_at: string;
  document_filename: string;
  total_lessons: number;
  completed_lessons: number;
  completion_percent: number;
  last_accessed_at: string | null;
}

export interface LessonRef {
  id: number;
  position: number;
  title: string;
  completed: boolean;
}

export interface TopicRef {
  id: number;
  position: number;
  title: string;
  lessons: LessonRef[];
}

export interface ChapterRef {
  id: number;
  position: number;
  title: string;
  summary: string;
  progress_percent: number;
  topics: TopicRef[];
}

export interface CourseDetail {
  id: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  estimated_minutes: number;
  objectives: string[];
  prerequisites: string[];
  status: CourseStatus;
  generation_stage: string | null;
  error: string | null;
  created_at: string;
  document: { id: number; filename: string; page_count: number };
  total_lessons: number;
  completed_lessons: number;
  completion_percent: number;
  chapters: ChapterRef[];
}

export interface CourseStatusResponse {
  id: number;
  status: CourseStatus;
  generation_stage: string | null;
  error: string | null;
}

export interface CourseProgress {
  course_id: number;
  total_lessons: number;
  completed_lessons: number;
  completion_percent: number;
  total_seconds_spent: number;
  chapters: {
    chapter_id: number;
    title: string;
    total_lessons: number;
    completed_lessons: number;
    progress_percent: number;
  }[];
}

export interface LessonSection {
  heading: string;
  body: string;
}

export interface LessonContent {
  sections: LessonSection[];
  key_takeaways: string[];
  important_notes: string[];
  real_world_examples: string[];
  summary: string;
}

export interface Lesson {
  id: number;
  title: string;
  position: number;
  topic_id: number;
  topic_title: string;
  chapter_id: number;
  chapter_title: string;
  course_id: number;
  course_title: string;
  completed: boolean;
  prev_lesson_id: number | null;
  next_lesson_id: number | null;
  content: LessonContent | null;
}

export interface CompleteLessonResponse {
  lesson_id: number;
  completed: true;
  completed_at: string;
}

export type QuestionType = "mcq" | "tf" | "short";

export interface QuizQuestion {
  id: number;
  type: QuestionType;
  question: string;
  options: string[] | null;
}

export interface Quiz {
  id: number;
  chapter_id: number;
  chapter_title: string;
  generated_at: string;
  questions: QuizQuestion[];
}

export interface QuizQuestionResult {
  question_id: number;
  question: string;
  type: QuestionType;
  your_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
}

export interface QuizAttemptResult {
  id: number;
  quiz_id: number;
  score: number;
  taken_at: string;
  results: QuizQuestionResult[];
}

export interface QuizAttemptSummary {
  id: number;
  score: number;
  taken_at: string;
}

export interface ChatSession {
  id: number;
  course_id: number;
  created_at: string;
  message_count?: number;
  last_message_preview?: string | null;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export type SearchResultType =
  | "course"
  | "chapter"
  | "topic"
  | "lesson"
  | "passage";

export interface SearchResult {
  type: SearchResultType;
  id: number;
  title: string;
  snippet: string;
  course_id: number;
  course_title: string;
  lesson_id: number | null;
  chapter_id: number | null;
  score: number | null;
}

export interface SearchResponse {
  query: string;
  mode: string;
  results: SearchResult[];
}

export interface DashboardStats {
  courses_count: number;
  lessons_completed: number;
  total_seconds_spent: number;
  streak_days: number;
  avg_quiz_score: number | null;
}

export interface ContinueLearning {
  course_id: number;
  course_title: string;
  lesson_id: number;
  lesson_title: string;
  chapter_title: string;
  completion_percent: number;
}

export interface DashboardData {
  stats: DashboardStats;
  continue_learning: ContinueLearning | null;
  courses: CourseSummary[];
}

export interface UploadResponse {
  course_id: number;
  document_id: number;
}

// ---------- Token management ----------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  // Mirror in a cookie so Next middleware can guard routes.
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(
    token
  )}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
}

// ---------- Errors ----------

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function handleUnauthorized(): void {
  clearToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let detail = `Request failed with status ${res.status}`;
  try {
    const body: unknown = await res.json();
    if (
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof (body as { detail: unknown }).detail === "string"
    ) {
      detail = (body as { detail: string }).detail;
    }
  } catch {
    // non-JSON error body; keep generic message
  }
  return new ApiError(res.status, detail);
}

// ---------- Core request helper ----------

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    handleUnauthorized();
    throw new ApiError(401, "Session expired. Please log in again.");
  }
  if (!res.ok) {
    throw await toApiError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// ---------- Auth ----------

export function register(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(): Promise<User> {
  return request<User>("/auth/me");
}

export function googleAuthUrl(): string {
  return `${API_URL}/auth/google`;
}

// ---------- Documents ----------

export function uploadDocument(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResponse>("/documents/upload", {
    method: "POST",
    body: form,
  });
}

// ---------- Courses ----------

export function getCourses(): Promise<CourseSummary[]> {
  return request<CourseSummary[]>("/courses");
}

export function getCourse(id: number): Promise<CourseDetail> {
  return request<CourseDetail>(`/courses/${id}`);
}

export function getCourseStatus(id: number): Promise<CourseStatusResponse> {
  return request<CourseStatusResponse>(`/courses/${id}/status`);
}

export function deleteCourse(id: number): Promise<void> {
  return request<void>(`/courses/${id}`, { method: "DELETE" });
}

export function getCourseProgress(id: number): Promise<CourseProgress> {
  return request<CourseProgress>(`/courses/${id}/progress`);
}

// ---------- Lessons ----------

export function getLesson(id: number): Promise<Lesson> {
  return request<Lesson>(`/lessons/${id}`);
}

export function completeLesson(
  id: number,
  secondsSpent: number
): Promise<CompleteLessonResponse> {
  return request<CompleteLessonResponse>(`/lessons/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ seconds_spent: secondsSpent }),
  });
}

export function uncompleteLesson(id: number): Promise<void> {
  return request<void>(`/lessons/${id}/complete`, { method: "DELETE" });
}

// ---------- Quizzes ----------

export function getChapterQuiz(chapterId: number): Promise<Quiz> {
  return request<Quiz>(`/chapters/${chapterId}/quiz`);
}

export function submitQuizAttempt(
  quizId: number,
  answers: Record<string, string>
): Promise<QuizAttemptResult> {
  return request<QuizAttemptResult>(`/quizzes/${quizId}/attempts`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export function getQuizAttempts(
  quizId: number
): Promise<QuizAttemptSummary[]> {
  return request<QuizAttemptSummary[]>(`/quizzes/${quizId}/attempts`);
}

// ---------- Chat ----------

export function createChatSession(courseId: number): Promise<ChatSession> {
  return request<ChatSession>("/chat/sessions", {
    method: "POST",
    body: JSON.stringify({ course_id: courseId }),
  });
}

export function getChatSessions(courseId: number): Promise<ChatSession[]> {
  return request<ChatSession[]>(`/chat/sessions?course_id=${courseId}`);
}

export function getChatMessages(sessionId: number): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
}

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onDone: (messageId: number) => void;
  onError: (message: string) => void;
}

/**
 * Sends a chat message and streams the assistant reply via SSE over POST.
 * EventSource cannot POST or set headers, so we parse the stream manually.
 */
export async function streamChatMessage(
  sessionId: number,
  content: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
    signal,
  });

  if (res.status === 401) {
    handleUnauthorized();
    callbacks.onError("Session expired. Please log in again.");
    return;
  }
  if (!res.ok || !res.body) {
    const err = await toApiError(res);
    callbacks.onError(err.detail);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return false;
    const payload = trimmed.slice(5).trim();
    if (!payload) return false;
    try {
      const event = JSON.parse(payload) as {
        delta?: string;
        done?: boolean;
        message_id?: number;
        error?: string;
      };
      if (typeof event.error === "string") {
        callbacks.onError(event.error);
        return true;
      }
      if (event.done) {
        callbacks.onDone(event.message_id ?? 0);
        return true;
      }
      if (typeof event.delta === "string") {
        callbacks.onDelta(event.delta);
      }
    } catch {
      // Ignore malformed SSE lines.
    }
    return false;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (processLine(line)) return;
      }
    }
    if (buffer) processLine(buffer);
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError("Connection lost while streaming the reply.");
    }
  }
}

// ---------- Search ----------

export function search(
  q: string,
  options: { courseId?: number; mode?: "keyword" | "semantic" } = {},
  signal?: AbortSignal
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q });
  if (options.courseId !== undefined)
    params.set("course_id", String(options.courseId));
  if (options.mode) params.set("mode", options.mode);
  return request<SearchResponse>(`/search?${params.toString()}`, { signal });
}

// ---------- Dashboard ----------

export function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>("/dashboard");
}
