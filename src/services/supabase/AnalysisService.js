import { createClient } from "@supabase/supabase-js";
import InvariantError from "../../exceptions/InvariantError.js";

export default class AnalysisService {
  constructor() {
    this._supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  async getTeacherDashboard(teacher_id, queryParams) {
    const summary = await this._getGlobalSummary(teacher_id);
    const questions = await this._getDetailedQuestionList(
      teacher_id,
      queryParams
    );

    return {
      summary,
      ...questions,
    };
  }

  async _getGlobalSummary(teacher_id) {
    const { data: questions, error: qErr } = await this._supabase
      .from("questions")
      .select("id, version")
      .eq("created_by", teacher_id);

    if (qErr) throw new InvariantError("Gagal hitung summary soal");

    const total_original = questions.filter(
      (q) => q.version === "original"
    ).length;

    const total_augmented = questions.filter(
      (q) => q.version === "augmentasi"
    ).length;

    const questionIds = questions.map((q) => q.id);

    let global_ratio = 0;
    if (questionIds.length > 0) {
      const { count: totalAttempts, error: tErr } = await this._supabase
        .from("student_answers")
        .select("*", { count: "exact", head: true })
        .in("question_id", questionIds);

      const { count: totalCorrect, error: cErr } = await this._supabase
        .from("student_answers")
        .select("*", { count: "exact", head: true })
        .in("question_id", questionIds)
        .eq("is_correct", true);

      if (!tErr && !cErr && totalAttempts > 0) {
        global_ratio = (totalCorrect / totalAttempts) ;
      }
    }

    return {
      total_questions: total_original,
      total_augmented: total_augmented,
      global_success_ratio: parseFloat(global_ratio.toFixed(2)),
    };
  }

  async _getDetailedQuestionList(
    teacher_id,
    {
      q,
      topic_id,
      subject_id,
      class_level,
      page = 1,
      limit = 10,
      sort = "created_at.desc",
    }
  ) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this._supabase
      .from("questions")
      .select(
        `
        id, question_text, option_a, option_b, option_c, option_d, option_e, 
        correct_answer, difficulty_level, cognitive_level, verification_status,
        version, created_at, image_url, image_caption,
        topics!inner(id, name, class_level, subjects!inner(id, name))
        `,
        { count: "exact" }
      )
      .eq("created_by", teacher_id)
      .range(from, to);

    if (q) query = query.ilike("question_text", `%${q}%`);
    if (topic_id) query = query.eq("topic_id", topic_id);
    if (subject_id) query = query.eq("topics.subjects.id", subject_id);
    if (class_level) query = query.eq("topics.class_level", class_level);

    const [field, direction] = sort.split(".");
    query = query.order(field, { ascending: direction === "asc" });

    const { data: questions, error, count } = await query;
    if (error)
      throw new InvariantError("Gagal load list soal: " + error.message);

    if (!questions || questions.length === 0) {
      return { data: [], meta: { page, limit, total: count ?? 0 } };
    }

    const displayedQuestionIds = questions.map((q) => q.id);

    const { data: answers, error: ansErr } = await this._supabase
      .from("student_answers")
      .select("question_id, student_answer, is_correct")
      .in("question_id", displayedQuestionIds);

    if (ansErr) throw new InvariantError("Gagal load statistik jawaban");

    const enrichedData = questions.map((question) => {
      const relevantAnswers = answers.filter(
        (a) => a.question_id === question.id
      );

      const total_attempts = relevantAnswers.length;
      const total_correct = relevantAnswers.filter((a) => a.is_correct).length;

      const distribution = { A: 0, B: 0, C: 0, D: 0, E: 0 };
      relevantAnswers.forEach((a) => {
        if (
          a.student_answer &&
          distribution[a.student_answer.toUpperCase()] !== undefined
        ) {
          distribution[a.student_answer.toUpperCase()]++;
        }
      });

      const success_ratio =
        total_attempts > 0
          ? (total_correct / total_attempts).toFixed(2)
          : 0;

      return {
        id: question.id,
        meta: {
          subject: question.topics.subjects.name,
          topic: question.topics.name,
          class_level: question.topics.class_level,
          version: question.version,
          created_at: question.created_at,
        },
        content: {
          text: question.question_text,
          correct_answer: question.correct_answer,
          difficulty: question.difficulty_level,
          cognitive: question.cognitive_level,
          status: question.verification_status,
          image_url: question.image_url,
          image_caption: question.image_caption,
          options: {
            A: question.option_a,
            B: question.option_b,
            C: question.option_c,
            D: question.option_d,
            E: question.option_e,
          },
        },
        stats: {
          total_attempts,
          total_correct,
          success_ratio: parseFloat(success_ratio),
          distribution,
        },
      };
    });

    return {
      data: enrichedData,
      meta: {
        page,
        limit,
        total: count ?? 0,
      },
    };
  }
}
