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

  /**
   * Mendapatkan laporan hasil ujian
   * @param {string} student_id - UUID siswa yang diminta
   * @param {number} room_id - ID room ujian
   * @param {string} viewer_role - "siswa" | "guru" | "admin"
   */
  async getStudentReport(student_id, room_id, viewer_role = "siswa") {
    // Jika guru/admin → ambil semua peserta di room
    if (viewer_role === "guru" || viewer_role === "admin") {
      const { data: participants, error: pErr } = await this._supabase
        .from("room_participants")
        .select("student_id")
        .eq("room_id", room_id);

      if (pErr)
        throw new InvariantError(
          "Gagal mengambil daftar peserta: " + pErr.message
        );
      if (!participants || participants.length === 0)
        throw new NotFoundError("Belum ada siswa dalam room ini.");

      // Ambil laporan tiap siswa paralel
      const reports = [];
      for (const p of participants) {
        const report = await this._getSingleStudentReport(
          p.student_id,
          room_id
        );
        reports.push({ student_id: p.student_id, ...report });
      }

      // Hitung rata-rata kelas
      const avg = {
        total_questions: 0,
        total_correct: 0,
        true_score: 0,
        expectation_score: 0,
        total_time_seconds: 0,
        avg_time_per_question: 0,
      };
      for (const r of reports) {
        avg.total_questions += r.summary.total_questions ?? 0;
        avg.total_correct += r.summary.total_correct ?? 0;
        avg.true_score += r.summary.true_score ?? 0;
        avg.expectation_score += r.summary.expectation_score ?? 0;
        avg.total_time_seconds += r.summary.total_time_seconds ?? 0;
        avg.avg_time_per_question += r.summary.avg_time_per_question ?? 0;
      }

      const count = reports.length || 1;
      const classSummary = {
        avg_total_questions: (avg.total_questions / count).toFixed(2),
        avg_total_correct: (avg.total_correct / count).toFixed(2),
        avg_true_score: (avg.true_score / count).toFixed(2),
        avg_expectation_score: (avg.expectation_score / count).toFixed(2),
        avg_total_time_seconds: (avg.total_time_seconds / count).toFixed(2),
        avg_time_per_question: (avg.avg_time_per_question / count).toFixed(2),
      };

      return {
        summary: classSummary,
        students: reports,
      };
    }

    // Jika bukan guru/admin → default per siswa
    return this._getSingleStudentReport(student_id, room_id);
  }

  /**
   * Mengambil laporan lengkap satu siswa di room tertentu
   */
  async _getSingleStudentReport(student_id, room_id) {
    // === Ambil data peserta ===
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
        rooms (assessment_mechanism),
        profiles (username, full_name, nomer_induk, email)
      `
      )
      .eq("room_id", room_id)
      .eq("student_id", student_id)
      .maybeSingle();

    if (pErr)
      throw new InvariantError("Gagal mengambil data peserta: " + pErr.message);
    if (!participant)
      throw new NotFoundError("Siswa tidak mengikuti ujian ini");

    // === Ambil riwayat jawaban ===
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

    // === Tiga soal terlama ===
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

    // === Rekap per level (berdasarkan level attempt) ===
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

    // === Return report siswa ===
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
