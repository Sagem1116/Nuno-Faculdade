import { supabase } from "@/integrations/supabase/client";

export type Course = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  position: number;
  created_at: string;
  summary?: unknown;
};

export type Module = {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  position: number;
  summary?: unknown;
};

export type LessonStatus = "not_started" | "in_progress" | "completed" | "mastered";

export type Lesson = {
  id: string;
  module_id: string;
  course_id: string;
  user_id: string;
  title: string;
  status: LessonStatus;
  content: unknown;
  notes: NoteItem[];
  reflection: ReflectionData;
  position: number;
  study_minutes: number;
  completed_at: string | null;
  updated_at: string;
  summary?: unknown;
  test?: unknown;
  case_study?: unknown;
  essay?: unknown;
};

export type NoteItem = {
  id: string;
  text: string;
  kind: "note" | "postit" | "highlight";
  category?: string;
  created_at: string;
};

export type ReflectionData = {
  learned?: string;
  not_understood?: string;
  to_review?: string;
  connections?: string;
  ideas?: string;
};

export type Profile = {
  id: string;
  university_name: string;
  university_logo: string | null;
  academic_year: string;
};

export async function getProfile(): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").maybeSingle();
  return data as Profile | null;
}

export async function updateProfile(patch: Partial<Profile>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authed");
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) throw error;
}

export async function listCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Course[];
}

export async function createCourse(input: { name: string; description?: string; emoji?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authed");
  const { data: existing } = await supabase
    .from("courses").select("position").eq("user_id", user.id)
    .order("position", { ascending: false }).limit(1);
  const position = ((existing?.[0]?.position ?? -1) as number) + 1;
  const { data, error } = await supabase
    .from("courses")
    .insert({ ...input, user_id: user.id, position })
    .select("*").single();
  if (error) throw error;
  return data as Course;
}

export async function updateCourse(id: string, patch: Partial<Course>) {
  const { error } = await supabase.from("courses").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteCourse(id: string) {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateCourse(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authed");
  const { data: source } = await supabase.from("courses").select("*").eq("id", id).single();
  if (!source) return;
  const newCourse = await createCourse({
    name: `${source.name} (cópia)`,
    description: source.description ?? "",
    emoji: source.emoji ?? "📚",
  });
  const { data: modules } = await supabase.from("modules").select("*").eq("course_id", id).order("position");
  for (const m of modules ?? []) {
    const { data: newMod } = await supabase
      .from("modules")
      .insert({ title: m.title, position: m.position, course_id: newCourse.id, user_id: user.id })
      .select("*").single();
    if (!newMod) continue;
    const { data: lessons } = await supabase.from("lessons").select("*").eq("module_id", m.id).order("position");
    for (const l of lessons ?? []) {
      await supabase.from("lessons").insert({
        title: l.title, position: l.position, status: "not_started",
        content: l.content, notes: l.notes, reflection: l.reflection,
        module_id: newMod.id, course_id: newCourse.id, user_id: user.id,
      });
    }
  }
  return newCourse;
}

export async function reorderCourses(ids: string[]) {
  await Promise.all(ids.map((id, i) =>
    supabase.from("courses").update({ position: i }).eq("id", id),
  ));
}

export async function getCourse(id: string): Promise<Course | null> {
  const { data } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  return data as Course | null;
}

export async function listModules(courseId: string): Promise<Module[]> {
  const { data, error } = await supabase
    .from("modules").select("*").eq("course_id", courseId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Module[];
}

export async function createModule(courseId: string, title: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authed");
  const { data: existing } = await supabase
    .from("modules").select("position").eq("course_id", courseId)
    .order("position", { ascending: false }).limit(1);
  const position = ((existing?.[0]?.position ?? -1) as number) + 1;
  const { data, error } = await supabase
    .from("modules").insert({ title, course_id: courseId, user_id: user.id, position })
    .select("*").single();
  if (error) throw error;
  return data as Module;
}

export async function updateModule(id: string, patch: Partial<Module>) {
  const { error } = await supabase.from("modules").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteModule(id: string) {
  const { error } = await supabase.from("modules").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderModules(ids: string[]) {
  await Promise.all(ids.map((id, i) =>
    supabase.from("modules").update({ position: i }).eq("id", id),
  ));
}

export async function listLessons(moduleId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from("lessons").select("*").eq("module_id", moduleId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Lesson[];
}

export async function listLessonsByCourse(courseId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from("lessons").select("*").eq("course_id", courseId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Lesson[];
}

export async function listAllLessons(): Promise<Lesson[]> {
  const { data, error } = await supabase.from("lessons").select("*");
  if (error) throw error;
  return (data ?? []) as unknown as Lesson[];
}

export async function createLesson(moduleId: string, courseId: string, title: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authed");
  const { data: existing } = await supabase
    .from("lessons").select("position").eq("module_id", moduleId)
    .order("position", { ascending: false }).limit(1);
  const position = ((existing?.[0]?.position ?? -1) as number) + 1;
  const { data, error } = await supabase
    .from("lessons").insert({
      title, module_id: moduleId, course_id: courseId, user_id: user.id, position,
    })
    .select("*").single();
  if (error) throw error;
  return data as unknown as Lesson;
}

export async function getLesson(id: string): Promise<Lesson | null> {
  const { data } = await supabase.from("lessons").select("*").eq("id", id).maybeSingle();
  return data as unknown as Lesson | null;
}

export async function updateLesson(id: string, patch: Partial<Lesson>) {
  const { error } = await supabase.from("lessons").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteLesson(id: string) {
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderLessons(ids: string[]) {
  await Promise.all(ids.map((id, i) =>
    supabase.from("lessons").update({ position: i }).eq("id", id),
  ));
}

export async function exportAll() {
  const [profile, courses, modules, lessons] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle().then((r) => r.data),
    supabase.from("courses").select("*").then((r) => r.data),
    supabase.from("modules").select("*").then((r) => r.data),
    supabase.from("lessons").select("*").then((r) => r.data),
  ]);
  return { version: 1, exported_at: new Date().toISOString(), profile, courses, modules, lessons };
}

export async function importAll(payload: { courses?: unknown[]; modules?: unknown[]; lessons?: unknown[] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authed");
  const courseMap = new Map<string, string>();
  const moduleMap = new Map<string, string>();
  for (const raw of payload.courses ?? []) {
    const c = raw as Course;
    const { data } = await supabase.from("courses").insert({
      name: c.name, description: c.description ?? "", emoji: c.emoji ?? "📚",
      position: c.position ?? 0, user_id: user.id,
    }).select("id").single();
    if (data) courseMap.set(c.id, data.id);
  }
  for (const raw of payload.modules ?? []) {
    const m = raw as Module;
    const newCourseId = courseMap.get(m.course_id);
    if (!newCourseId) continue;
    const { data } = await supabase.from("modules").insert({
      title: m.title, position: m.position, course_id: newCourseId, user_id: user.id,
    }).select("id").single();
    if (data) moduleMap.set(m.id, data.id);
  }
  for (const raw of payload.lessons ?? []) {
    const l = raw as Lesson;
    const newModuleId = moduleMap.get(l.module_id);
    const newCourseId = courseMap.get(l.course_id);
    if (!newModuleId || !newCourseId) continue;
    await supabase.from("lessons").insert({
      title: l.title, status: l.status, position: l.position,
      content: l.content as never, notes: l.notes as never, reflection: l.reflection as never,
      study_minutes: l.study_minutes ?? 0,
      module_id: newModuleId, course_id: newCourseId, user_id: user.id,
    });
  }
}