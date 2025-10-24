import { createClient } from "@supabase/supabase-js";
import InvariantError from "../../exceptions/InvariantError.js";
import NotFoundError from "../../exceptions/NotFoundError.js";

export default class ResultService {
  constructor() {
    this._supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  /** =====================================================================
   * [A] Untuk siswa: laporan hasil ujian pribadi
   * ===================================================================== */
  async getStudentReport(student_id, room_id) {
    return this._getSingleStudentReport(student_id, room_id);
  }

  /** =====================================================================
   * [B] Untuk guru/admin: rekap keseluruhan kelas dalam 1 room
   * ===================================================================== */
  async getRoomSummaryForTeacher(room_id) {
    const { data: participants, error: pErr } = await this._supabase
      .from("room_participants")
      .select("student_id")
      .eq("room_id", room_id);

    if (pErr)
      throw new InvariantError("Gagal mengambil peserta: " + pErr.message);
    if (!participants?.length)
      throw new NotFoundError("Belum ada siswa di room ini.");

    // Ambil laporan setiap siswa
    const reports = await Promise.all(
      participants.map(async (p) => {
        const r = await this._getSingleStudentReport(p.student_id, room_id);
        return {
          student_id: r.identity.student_id,
          nama: r.identity.nama,
          nomer_induk: r.identity.nomer_induk,
          total_correct: r.summary.total_correct,
          total_questions: r.summary.total_questions,
          true_score: r.summary.true_score,
          expectation_score: r.summary.expectation_score,
          total_time_seconds: r.summary.total_time_seconds,
          avg_time_per_question: r.summary.avg_time_per_question,
        };
      })
    );

    // Hitung rata-rata keseluruhan kelas
    const n = reports.length;
    const avg = {
      total_questions: (
        reports.reduce((a, b) => a + (b.total_questions ?? 0), 0) / n
      ).toFixed(2),
      total_correct: (
        reports.reduce((a, b) => a + (b.total_correct ?? 0), 0) / n
      ).toFixed(2),
      true_score: (
        reports.reduce((a, b) => a + (b.true_score ?? 0), 0) / n
      ).toFixed(2),
      expectation_score: (
        reports.reduce((a, b) => a + (b.expectation_score ?? 0), 0) / n
      ).toFixed(2),
      total_time_seconds: (
        reports.reduce((a, b) => a + (b.total_time_seconds ?? 0), 0) / n
      ).toFixed(2),
      avg_time_per_question: (
        reports.reduce((a, b) => a + (b.avg_time_per_question ?? 0), 0) / n
      ).toFixed(2),
    };

    return {
      room_summary: avg,
      participants: reports,
    };
  }

  /** =====================================================================
   * [C] Untuk guru/admin: detail satu siswa di room
   * ===================================================================== */
  async getStudentDetailForTeacher(student_id, room_id) {
    return this._getSingleStudentReport(student_id, room_id);
  }

  /** =====================================================================
   * [PRIVATE] Fungsi mengambil laporan lengkap satu siswa
   * ===================================================================== */
  async _getSingleStudentReport(student_id, room_id) {
    const { data: participant, error: pErr } = await this._supabase
      .from("room_participants")
      .select(
        `
        total_questions_answered,
        total_correct,
        true_score,
        expectation_score,
        total_time_seconds,
        avg_time_per_question,
        finished_at,
        rooms (name, assessment_mechanism),
        profiles (username, full_name, nomer_induk, email)
      `
      )
      .eq("room_id", room_id)
      .eq("student_id", student_id)
      .maybeSingle();

    if (pErr)
      throw new InvariantError("Gagal mengambil data peserta: " + pErr.message);
    if (!participant)
      throw new NotFoundError("Siswa tidak mengikuti ujian ini.");

    // Ambil riwayat jawaban siswa
    const { data: answers, error: aErr } = await this._supabase
      .from("student_answers")
      .select(
        `
        id, student_answer, is_correct, time_taken_seconds, question_level_at_attempt,
        questions (
          question_text,
          option_a, option_b, option_c, option_d, option_e,
          correct_answer, difficulty_level,
          topics (name)
        )
      `
      )
      .eq("student_id", student_id)
      .eq("room_id", room_id)
      .order("answered_at", { ascending: true });

    if (aErr)
      throw new InvariantError(
        "Gagal mengambil riwayat jawaban: " + aErr.message
      );

    // Soal terlama (3 soal)
    const longest = [...(answers ?? [])]
      .sort((a, b) => b.time_taken_seconds - a.time_taken_seconds)
      .slice(0, 3)
      .map((a) => ({
        question: a.questions.question_text,
        topic: a.questions.topics?.name,
        level: a.question_level_at_attempt,
        correct: a.is_correct,
        time: a.time_taken_seconds,
      }));

    // Rekap per level soal
    const levelSummary = {};
    for (const a of answers ?? []) {
      const lvl = a.question_level_at_attempt;
      if (!levelSummary[lvl]) levelSummary[lvl] = { total: 0, correct: 0 };
      levelSummary[lvl].total++;
      if (a.is_correct) levelSummary[lvl].correct++;
    }

    const levelStats = Object.entries(levelSummary).map(([lvl, s]) => ({
      level: Number(lvl),
      total: s.total,
      correct: s.correct,
      percent: ((s.correct / s.total) * 100).toFixed(2),
    }));

    return {
      summary: {
        total_questions: participant.total_questions_answered,
        total_correct: participant.total_correct,
        true_score: participant.true_score,
        expectation_score: participant.expectation_score,
        total_time_seconds: participant.total_time_seconds,
        avg_time_per_question: participant.avg_time_per_question,
        finished_at: participant.finished_at,
      },
      identity: {
        student_id,
        nama: participant.profiles?.full_name ?? "(Tanpa Nama)",
        username: participant.profiles?.username,
        nomer_induk: participant.profiles?.nomer_induk,
        email: participant.profiles?.email,
      },
      room_info: {
        room_id,
        room_name: participant.rooms?.name ?? "Tanpa Nama Room",
        assessment_mechanism:
          participant.rooms?.assessment_mechanism ?? "Tidak Diketahui",
      },
      history: (answers ?? []).map((a) => ({
        question: a.questions.question_text,
        topic: a.questions.topics?.name,
        options: {
          A: a.questions.option_a,
          B: a.questions.option_b,
          C: a.questions.option_c,
          D: a.questions.option_d,
          E: a.questions.option_e,
        },
        correct_answer: a.questions.correct_answer,
        student_answer: a.student_answer,
        is_correct: a.is_correct,
        difficulty_level: a.questions.difficulty_level,
        level_at_attempt: a.question_level_at_attempt,
        time_taken_seconds: a.time_taken_seconds,
      })),
      top_slowest: longest,
      level_performance: levelStats,
    };
  }
}
