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

  async getStudentReport(student_id, room_id) {
    return this._getSingleStudentReport(student_id, room_id);
  }

  async getTeacherOverview(room_id) {
    const { data: participants, error: pErr } = await this._supabase
      .from("room_participants")
      .select(
        `
        student_id, total_correct, total_questions_answered, 
        true_score, total_time_seconds, finished_at,
        profiles (full_name, nomer_induk)
      `
      )
      .eq("room_id", room_id)
      .order("true_score", { ascending: false });

    if (pErr) throw new InvariantError("Gagal load overview: " + pErr.message);

    const total_students = participants.length;
    if (total_students === 0) throw new NotFoundError("Belum ada data siswa.");

    let sumScore = 0,
      sumTime = 0,
      sumCorrect = 0,
      sumRatio = 0;
    participants.forEach((p) => {
      sumScore += p.true_score || 0;
      sumTime += p.total_time_seconds || 0;
      sumCorrect += p.total_correct || 0;

      const ratio =
        p.total_questions_answered > 0
          ? (p.total_correct / p.total_questions_answered) * 100
          : 0;
      sumRatio += ratio;
    });

    const summary = {
      total_students,
      avg_true_score: (sumScore / total_students).toFixed(2),
      avg_time_seconds: (sumTime / total_students).toFixed(0),
      avg_correct_count: (sumCorrect / total_students).toFixed(1),
      avg_success_ratio: (sumRatio / total_students).toFixed(2),
    };

    const top_3_students = participants.slice(0, 3).map((p) => ({
      nama: p.profiles.full_name,
      nomer_induk: p.profiles.nomer_induk,
      true_score: p.true_score,
      success_ratio:
        p.total_questions_answered > 0
          ? ((p.total_correct / p.total_questions_answered) * 100).toFixed(1)
          : 0,
      avg_time_per_q:
        p.total_questions_answered > 0
          ? (p.total_time_seconds / p.total_questions_answered).toFixed(1)
          : 0,
    }));

    const { data: allAnswers } = await this._supabase
      .from("student_answers")
      .select(
        `
        question_id, is_correct, cognitive_level, 
        questions (question_text, difficulty_level, cognitive_level)
      `
      )
      .eq("room_id", room_id);

    const cogStats = {
      C1: { correct: 0, total: 0 },
      C2: { correct: 0, total: 0 },
      C3: { correct: 0, total: 0 },
      C4: { correct: 0, total: 0 },
      C5: { correct: 0, total: 0 },
      C6: { correct: 0, total: 0 },
    };
    const questionStats = {};

    (allAnswers || []).forEach((a) => {
      const cog = a.cognitive_level || a.questions?.cognitive_level || "C1";
      if (cogStats[cog]) {
        cogStats[cog].total++;
        if (a.is_correct) cogStats[cog].correct++;
      }

      const qId = a.question_id;
      if (!questionStats[qId]) {
        questionStats[qId] = {
          id: qId,
          text: a.questions?.question_text,
          cog: a.questions?.cognitive_level,
          diff: a.questions?.difficulty_level,
          total: 0,
          correct: 0,
        };
      }
      questionStats[qId].total++;
      if (a.is_correct) questionStats[qId].correct++;
    });

    const cognitive_breakdown = Object.entries(cogStats).map(
      ([level, stat]) => ({
        level,
        total_attempts: stat.total,
        success_ratio:
          stat.total > 0 ? ((stat.correct / stat.total) * 100).toFixed(1) : 0,
      })
    );

    const qArray = Object.values(questionStats).map((q) => ({
      ...q,
      ratio: q.total > 0 ? (q.correct / q.total) * 100 : 0,
    }));
    qArray.sort((a, b) => b.ratio - a.ratio);

    return {
      summary,
      top_3_students,
      cognitive_breakdown,
      top_5_easiest: qArray.slice(0, 5),
      top_5_hardest: qArray.slice(-5).reverse(),
    };
  }

  async getTeacherQuestionAnalysis(room_id) {
    // 1. Ambil jawaban siswa di room ini
    const { data: allAnswers, error } = await this._supabase
      .from("student_answers")
      .select(
        `
        question_id, is_correct, student_answer,
        questions (
            id, question_text, image_url, option_a, option_b, option_c, option_d, option_e, 
            correct_answer, difficulty_level, cognitive_level, topics(name)
        )
      `
      )
      .eq("room_id", room_id);

    if (error)
      throw new InvariantError("Gagal load analisis soal: " + error.message);

    const map = {};

    // 2. Iterasi & Agregasi Data
    (allAnswers || []).forEach((a) => {
      const qId = a.question_id;

      // Inisialisasi object soal jika belum ada di map
      if (!map[qId]) {
        const qData = a.questions;
        map[qId] = {
          question_id: qId,
          text_preview: qData.question_text,
          // Tambahkan detail lain yg berguna untuk FE
          image_url: qData.image_url,
          options: {
            A: qData.option_a,
            B: qData.option_b,
            C: qData.option_c,
            D: qData.option_d,
            E: qData.option_e,
          },
          correct_answer: qData.correct_answer,
          topic: qData.topics?.name,
          master_diff: qData.difficulty_level,
          master_cog: qData.cognitive_level,

          // Statistik Room
          stats_attempts: 0, // Total yg jawab soal ini di room ini
          stats_correct: 0, // Total yg jawab BENAR

          // Distribusi Jawaban (Ini yg diminta)
          distribution: {
            A: 0,
            B: 0,
            C: 0,
            D: 0,
            E: 0,
          },
        };
      }

      // Update Statistik
      map[qId].stats_attempts++;
      if (a.is_correct) map[qId].stats_correct++;

      // Hitung Distribusi Pilihan Siswa
      if (a.student_answer) {
        const ansKey = a.student_answer.toUpperCase();
        if (map[qId].distribution[ansKey] !== undefined) {
          map[qId].distribution[ansKey]++;
        }
      }
    });

    // 3. Konversi Map ke Array & Hitung Rasio
    const list = Object.values(map).map((item) => ({
      ...item,
      success_ratio:
        item.stats_attempts > 0
          ? (item.stats_correct / item.stats_attempts).toFixed(2) // Float 0.00 - 1.00
          : 0,
    }));

    // Sort dari soal dengan rasio keberhasilan TERENDAH (Paling sulit)
    list.sort(
      (a, b) => parseFloat(a.success_ratio) - parseFloat(b.success_ratio)
    );

    return list;
  }

  async getTeacherStudentList(room_id) {
    const { data, error } = await this._supabase
      .from("room_participants")
      .select(
        `
        student_id, total_questions_answered, total_correct, true_score, 
        total_time_seconds, finished_at,
        profiles (full_name, nomer_induk, username)
      `
      )
      .eq("room_id", room_id);

    if (error) throw new InvariantError("Gagal load siswa: " + error.message);

    const result = data.map((p) => {
      const answered = p.total_questions_answered || 0;
      const time = p.total_time_seconds || 0;
      return {
        student_id: p.student_id,
        nama: p.profiles.full_name,
        nomer_induk: p.profiles.nomer_induk,
        true_score: p.true_score,
        stats: {
          answered,
          correct: p.total_correct,
          success_ratio:
            answered > 0 ? ((p.total_correct / answered) * 100).toFixed(1) : 0,
          avg_time_seconds: answered > 0 ? (time / answered).toFixed(1) : 0,
        },
        status: p.finished_at ? "Selesai" : "Belum Selesai",
      };
    });

    result.sort((a, b) => a.nama.localeCompare(b.nama));
    return result;
  }

  async _getSingleStudentReport(student_id, room_id) {
    const { data: participant, error: pErr } = await this._supabase
      .from("room_participants")
      .select(
        `*, rooms(name, assessment_mechanism, question_count), profiles(full_name, nomer_induk, username, email)`
      )
      .eq("room_id", room_id)
      .eq("student_id", student_id)
      .maybeSingle();

    if (pErr || !participant)
      throw new NotFoundError("Data siswa tidak ditemukan.");

    const { data: answers, error: aErr } = await this._supabase
      .from("student_answers")
      .select(
        `
        student_answer, is_correct, time_taken_seconds, 
        question_level_at_attempt, cognitive_level, answered_at,
        questions (question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, topics(name))
      `
      )
      .eq("room_id", room_id)
      .eq("student_id", student_id)
      .order("answered_at", { ascending: true });

    if (aErr) throw new InvariantError("Gagal load jawaban: " + aErr.message);

    const cogStats = {};
    (answers || []).forEach((a) => {
      const cog = a.cognitive_level || "C1";
      if (!cogStats[cog]) cogStats[cog] = { total: 0, correct: 0 };
      cogStats[cog].total++;
      if (a.is_correct) cogStats[cog].correct++;
    });

    const cognitive_performance = Object.entries(cogStats)
      .map(([level, stat]) => ({
        level,
        total: stat.total,
        success_ratio:
          stat.total > 0 ? ((stat.correct / stat.total) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => a.level.localeCompare(b.level));

    const question_history = (answers || []).map((a, idx) => ({
      no: idx + 1,
      text: a.questions.question_text,
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
      topic: a.questions.topics?.name,
      meta: {
        difficulty: a.question_level_at_attempt,
        cognitive: a.cognitive_level,
        time: a.time_taken_seconds,
      },
    }));

    return {
      identity: {
        nama: participant.profiles.full_name,
        nomer_induk: participant.profiles.nomer_induk,
        username: participant.profiles.username,
      },
      summary: {
        true_score: participant.true_score,
        correct_count: participant.total_correct,
        answered_count: participant.total_questions_answered,
        room_total_questions: participant.rooms.question_count,
        avg_time:
          participant.total_questions_answered > 0
            ? (
                participant.total_time_seconds /
                participant.total_questions_answered
              ).toFixed(1)
            : 0,
      },
      cognitive_performance,
      question_history,
    };
  }

  async getStudentDetailForTeacher(student_id, room_id) {
    return this._getSingleStudentReport(student_id, room_id);
  }
}
