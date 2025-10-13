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
      .from("question") // bucket name kamu
      .upload(fileName, file._data, {
        upsert: true,
        contentType: file.hapi.headers["content-type"],
      });

    if (error)
      throw new InvariantError("Gagal upload gambar soal: " + error.message);

    const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/question/${fileName}`;
    return url;
  }

  /* ====================== TOPICS ====================== */
  async _getTopicById(id) {
    const { data, error } = await this._supabase
      .from("topics")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (error)
      throw new InvariantError("Gagal mendapatkan topik: " + error.message);
    return data || null;
  }

  async _getTopicByName(name) {
    const { data, error } = await this._supabase
      .from("topics")
      .select("id, name")
      .eq("name", name)
      .maybeSingle();

    if (error)
      throw new InvariantError("Gagal mendapatkan topik: " + error.message);
    return data || null;
  }

  async _getOrCreateTopicByName(name) {
    const existing = await this._getTopicByName(name);
    if (existing) return existing;

    const { data, error } = await this._supabase
      .from("topics")
      .insert({ name })
      .select("id, name")
      .single();

    if (error)
      throw new InvariantError("Gagal membuat topik baru: " + error.message);
    return data;
  }

  async listTopics({ q }) {
    let query = this._supabase
      .from("topics")
      .select("id, name", { count: "exact" })
      .order("id", { ascending: true });

    if (q) query = query.ilike("name", `%${q}%`);

    const { data, error, count } = await query;
    if (error)
      throw new InvariantError(
        "Gagal mendapatkan daftar topik: " + error.message
      );

    return { data, meta: { total: count ?? 0 } };
  }

  async createTopic({ name }) {
    const existing = await this._getTopicByName(name);
    if (existing) return existing;

    const { data, error } = await this._supabase
      .from("topics")
      .insert({ name })
      .select("id, name")
      .single();

    if (error)
      throw new InvariantError("Gagal menambahkan topik: " + error.message);
    return data;
  }

  async deleteTopic(id) {
    const { error } = await this._supabase.from("topics").delete().eq("id", id);
    if (error)
      throw new InvariantError("Gagal menghapus topik: " + error.message);
  }

  /* ====================== QUESTIONS ====================== */

  async listQuestions({
    q,
    topic_id,
    difficulty_level,
    version,
    page = 1,
    limit = 20,
    sort = "created_at.desc",
  }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this._supabase
      .from("questions")
      .select(
        `id, topic_id, version, question_text, image_url, option_a, option_b, option_c, option_d, option_e, correct_answer, difficulty_level, discrimination_index, created_at, updated_at, topics(name)`,
        { count: "exact" }
      )
      .range(from, to);

    if (q) query = query.ilike("question_text", `%${q}%`);
    if (topic_id) query = query.eq("topic_id", topic_id);
    if (difficulty_level)
      query = query.eq("difficulty_level", difficulty_level);
    if (version) query = query.eq("version", version);

    const [field, direction] = sort.split(".");
    query = query.order(field, { ascending: direction === "asc" });

    const { data, error, count } = await query;
    if (error)
      throw new InvariantError(
        "Gagal mendapatkan daftar soal: " + error.message
      );

    return { data, meta: { page, limit, total: count ?? 0 } };
  }

  async getQuestionById(id) {
    const { data, error } = await this._supabase
      .from("questions")
      .select(`*, topics(name)`)
      .eq("id", id)
      .maybeSingle();

    if (error)
      throw new InvariantError("Gagal mendapatkan soal: " + error.message);
    if (!data) throw new NotFoundError("Soal tidak ditemukan");
    return data;
  }

  async createQuestion(payload) {
    let topicId = payload.topic_id ?? null;

    if (!topicId && payload.topic_name) {
      const topic = await this._getOrCreateTopicByName(payload.topic_name);
      topicId = topic.id;
    }

    if (topicId) {
      const topic = await this._getTopicById(topicId);
      if (!topic) throw new InvariantError("Topik tidak ditemukan");
    }

    // upload gambar jika ada
    let imageUrl = payload.image_url ?? null;
    if (payload.image_file) {
      imageUrl = await this._uploadImage(payload.image_file);
    }

    const insertPayload = {
      topic_id: topicId,
      version: payload.version ?? "original",
      question_text: payload.question_text,
      image_url: imageUrl,
      option_a: payload.option_a,
      option_b: payload.option_b,
      option_c: payload.option_c,
      option_d: payload.option_d,
      option_e: payload.option_e,
      correct_answer: payload.correct_answer,
      parent_question_id: payload.parent_question_id ?? null,
    };

    const { data, error } = await this._supabase
      .from("questions")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error)
      throw new InvariantError("Gagal menambahkan soal: " + error.message);
    return data;
  }

  async updateQuestion(id, payload) {
    let topicId = payload.topic_id ?? undefined;

    if (payload.topic_name) {
      const topic = await this._getOrCreateTopicByName(payload.topic_name);
      topicId = topic.id;
    }

    // upload gambar baru jika ada
    let imageUrl = payload.image_url ?? undefined;
    if (payload.image_file) {
      imageUrl = await this._uploadImage(payload.image_file);
    }

    const updatePayload = {
      ...(topicId !== undefined && { topic_id: topicId }),
      ...(payload.question_text && { question_text: payload.question_text }),
      ...(imageUrl !== undefined && { image_url: imageUrl }),
      ...(payload.option_a && { option_a: payload.option_a }),
      ...(payload.option_b && { option_b: payload.option_b }),
      ...(payload.option_c && { option_c: payload.option_c }),
      ...(payload.option_d && { option_d: payload.option_d }),
      ...(payload.option_e && { option_e: payload.option_e }),
      ...(payload.correct_answer && { correct_answer: payload.correct_answer }),
      ...(payload.difficulty_level && {
        difficulty_level: payload.difficulty_level,
      }),
      ...(payload.discrimination_index && {
        discrimination_index: payload.discrimination_index,
      }),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this._supabase
      .from("questions")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error)
      throw new InvariantError("Gagal memperbarui soal: " + error.message);
    if (!data) throw new NotFoundError("Soal tidak ditemukan");
    return data;
  }

  async deleteQuestion(id) {
    const { error } = await this._supabase
      .from("questions")
      .delete()
      .eq("id", id);
    if (error)
      throw new InvariantError("Gagal menghapus soal: " + error.message);
  }
}
