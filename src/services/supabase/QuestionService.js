import { createClient } from "@supabase/supabase-js";
import InvariantError from "../../exceptions/InvariantError.js";
import NotFoundError from "../../exceptions/NotFoundError.js";
import crypto from "crypto";

export default class QuestionService {
  constructor() {
    this._supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  /* ====================== UPLOAD IMAGE ====================== */
  async _uploadImage(file) {
    const fileExt = file.hapi.filename.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const { error } = await this._supabase.storage
      .from("question")
      .upload(fileName, file._data, {
        upsert: true,
        contentType: file.hapi.headers["content-type"],
      });

    if (error)
      throw new InvariantError("Gagal upload gambar soal: " + error.message);

    const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/question/${fileName}`;
    return url;
  }

  /* ====================== SUBJECTS ====================== */
  async listSubjects() {
    const { data, error } = await this._supabase
      .from("subjects")
      .select("id, name")
      .order("name", { ascending: true });
    if (error)
      throw new InvariantError("Gagal load subjects: " + error.message);
    return data;
  }

  /* ====================== TOPICS ====================== */
  async _getTopicById(id) {
    const { data, error } = await this._supabase
      .from("topics")
      .select("id, name, class_level, subject_id")
      .eq("id", id)
      .maybeSingle();
    if (error)
      throw new InvariantError("Error checking topic: " + error.message);
    return data;
  }

  async _getTopicByNameClassAndSubject(name, class_level, subject_id) {
    const { data, error } = await this._supabase
      .from("topics")
      .select("id, name, class_level, subject_id")
      .eq("name", name)
      .eq("class_level", class_level)
      .eq("subject_id", subject_id)
      .maybeSingle();
    if (error)
      throw new InvariantError(
        "Error checking topic by name: " + error.message
      );
    return data;
  }

  async _getOrCreateTopic(name, class_level, subject_id) {
    const existing = await this._getTopicByNameClassAndSubject(
      name,
      class_level,
      subject_id
    );
    if (existing) return existing;

    const { data, error } = await this._supabase
      .from("topics")
      .insert({ name, class_level, subject_id }) // Class Level masuk sini!
      .select("*")
      .single();

    if (error)
      throw new InvariantError("Gagal membuat topik baru: " + error.message);
    return data;
  }

  async _getOrCreateLearningObjective(content, topic_id) {
    // Cek existing CP dalam topik tersebut
    const { data: existing } = await this._supabase
      .from("learning_objectives")
      .select("id, content, topic_id")
      .eq("content", content)
      .eq("topic_id", topic_id)
      .maybeSingle();

    if (existing) return existing;

    // Create new CP
    const { data, error } = await this._supabase
      .from("learning_objectives")
      .insert({ content, topic_id })
      .select("*")
      .single();

    if (error)
      throw new InvariantError(
        "Gagal membuat Capaian Pembelajaran baru: " + error.message
      );
    return data;
  }

  async listTopics({ q, subject_id, class_level }) {
    let query = this._supabase
      .from("topics")
      .select("id, name, class_level, subjects(name)", { count: "exact" })
      .eq("subject_id", subject_id)
      .order("id", { ascending: true });

    if (q) query = query.ilike("name", `%${q}%`);
    if (class_level) query = query.eq("class_level", class_level);

    const { data, error, count } = await query;
    if (error) throw new InvariantError("Gagal load topics: " + error.message);
    return { data, meta: { total: count ?? 0 } };
  }

  async listLearningObjectives({ topic_id }) {
    const { data, error } = await this._supabase
      .from("learning_objectives")
      .select("id, content")
      .eq("topic_id", topic_id)
      .order("id", { ascending: true });

    if (error) throw new InvariantError("Gagal load CP: " + error.message);
    return data;
  }

  /* ====================== QUESTIONS ====================== */
  async createQuestion(payload) {
    let finalTopicId = payload.topic_id ?? null;
    let finalLoId = payload.learning_objective_id ?? null;

    if (!finalTopicId && payload.topic_name) {
      if (!payload.subject_id) {
        throw new InvariantError(
          "Subject ID wajib dipilih untuk membuat topik baru."
        );
      }

      const topic = await this._getOrCreateTopic(
        payload.topic_name,
        payload.class_level ?? 11,
        payload.subject_id
      );
      finalTopicId = topic.id;
    }

    if (!finalTopicId) {
      throw new InvariantError("Topik harus dipilih atau dibuat.");
    }

    if (!finalLoId && payload.learning_objective_text) {
      const lo = await this._getOrCreateLearningObjective(
        payload.learning_objective_text,
        finalTopicId
      );
      finalLoId = lo.id;
    }

    let imageUrl = payload.image_url ?? null;
    if (payload.image_file) {
      imageUrl = await this._uploadImage(payload.image_file);
    }

    const insertPayload = {
      topic_id: finalTopicId,
      learning_objective_id: finalLoId,
      version: payload.version ?? "original",
      question_text: payload.question_text,
      image_url: imageUrl,
      image_caption: payload.image_caption ?? null,
      option_a: payload.option_a,
      option_b: payload.option_b,
      option_c: payload.option_c,
      option_d: payload.option_d,
      option_e: payload.option_e,
      correct_answer: payload.correct_answer,
      parent_question_id: payload.parent_question_id ?? null,
      difficulty_level: payload.difficulty_level ?? 2,
      cognitive_level: payload.cognitive_level,
      created_by: payload.created_by ?? null,
      a_irt: payload.a_irt ?? null,
      b_irt: payload.b_irt ?? null,
      verification_status: "belum valid",
    };

    const { data, error } = await this._supabase
      .from("questions")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) throw new InvariantError("Gagal simpan soal: " + error.message);
    return data;
  }

  async updateQuestion(id, payload) {
    let finalTopicId = payload.topic_id ?? undefined;
    let finalLoId = payload.learning_objective_id ?? undefined;

    if (payload.topic_name) {
      if (!payload.subject_id) {
        throw new InvariantError(
          "Subject ID wajib untuk ganti topik via nama."
        );
      }
      const topic = await this._getOrCreateTopic(
        payload.topic_name,
        payload.class_level ?? 11,
        payload.subject_id
      );
      finalTopicId = topic.id;
    }

    if (payload.learning_objective_text) {
      let targetTopicId = finalTopicId;

      if (!targetTopicId) {
        // Ambil topic ID existing dari soal ini
        const existingQ = await this.getQuestionById(id);
        targetTopicId = existingQ.topic_id;
      }

      const lo = await this._getOrCreateLearningObjective(
        payload.learning_objective_text,
        targetTopicId
      );
      finalLoId = lo.id;
    }

    let imageUrl = payload.image_url ?? undefined;
    if (payload.image_file) {
      imageUrl = await this._uploadImage(payload.image_file);
    }

    const updatePayload = {
      ...(finalTopicId !== undefined && { topic_id: finalTopicId }),
      ...(finalLoId !== undefined && { learning_objective_id: finalLoId }),
      ...(payload.question_text && { question_text: payload.question_text }),
      ...(imageUrl !== undefined && { image_url: imageUrl }),
      ...(payload.image_caption !== undefined && {
        image_caption: payload.image_caption,
      }),
      ...(payload.option_a && { option_a: payload.option_a }),
      ...(payload.option_b && { option_b: payload.option_b }),
      ...(payload.option_c && { option_c: payload.option_c }),
      ...(payload.option_d && { option_d: payload.option_d }),
      ...(payload.option_e && { option_e: payload.option_e }),
      ...(payload.correct_answer && { correct_answer: payload.correct_answer }),
      ...(payload.difficulty_level && {
        difficulty_level: payload.difficulty_level,
      }),
      ...(payload.cognitive_level && {
        cognitive_level: payload.cognitive_level,
      }),
      ...(payload.verification_status && {
        verification_status: payload.verification_status,
      }),
      ...(payload.notes && { notes: payload.notes }),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this._supabase
      .from("questions")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new InvariantError("Gagal update soal: " + error.message);
    return data;
  }

  async listQuestions({
    q,
    topic_id,
    subject_id,
    difficulty_level,
    version,
    cognitive_level,
    verification_status,
    page = 1,
    limit = 20,
    sort = "created_at.desc",
  }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this._supabase
      .from("questions")
      .select(
        `id, topic_id, version, question_text, image_url, image_caption, option_a, option_b, option_c, option_d, option_e, correct_answer,
          difficulty_level, discrimination_index, cognitive_level, verification_status, notes, created_by, created_at, updated_at,
          topics!inner(name, class_level, subjects!inner(id, name)), learning_objectives(id, content)`,
        { count: "exact" }
      )
      .range(from, to);

    if (q) query = query.ilike("question_text", `%${q}%`);
    if (topic_id) query = query.eq("topic_id", topic_id);
    if (subject_id) query = query.eq("topics.subjects.id", subject_id); // Filter by Subject
    if (difficulty_level)
      query = query.eq("difficulty_level", difficulty_level);
    if (version) query = query.eq("version", version);
    if (cognitive_level) query = query.eq("cognitive_level", cognitive_level);
    if (verification_status)
      query = query.eq("verification_status", verification_status);

    const [field, direction] = sort.split(".");
    query = query.order(field, { ascending: direction === "asc" });

    const { data, error, count } = await query;
    if (error) throw new InvariantError("Gagal load soal: " + error.message);
    return { data, meta: { page, limit, total: count ?? 0 } };
  }

  async getQuestionById(id) {
    const { data, error } = await this._supabase
      .from("questions")
      .select(
        `*, topics(name, class_level, subjects(name)), learning_objectives(id, content)`
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new InvariantError("Gagal get soal: " + error.message);
    if (!data) throw new NotFoundError("Soal tidak ditemukan");
    return data;
  }

  async deleteQuestion(id) {
    const { error } = await this._supabase
      .from("questions")
      .delete()
      .eq("id", id);
    if (error) throw new InvariantError("Gagal hapus soal: " + error.message);
  }
}
