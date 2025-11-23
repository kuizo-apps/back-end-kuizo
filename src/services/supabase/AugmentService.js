import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import InvariantError from "../../exceptions/InvariantError.js";
import NotFoundError from "../../exceptions/NotFoundError.js";

export default class AugmentService {
  constructor() {
    this._supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    this._genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  async _getQuestionById(id) {
    const { data, error } = await this._supabase
      .from("questions")
      .select(
        `id, topic_id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, cognitive_level, difficulty_level, image_url, image_caption, topics(name, class_level)`
      )
      .eq("id", id)
      .maybeSingle();

    if (error)
      throw new InvariantError("Gagal mengambil data soal: " + error.message);
    if (!data) throw new NotFoundError("Soal tidak ditemukan");
    return data;
  }

  _validateAugmentedOutput(original, parsed) {
    const requiredTop = [
      "level_kognitif",
      "level_kognitif_target",
      "soal_augmentasi",
    ];
    for (const k of requiredTop) {
      if (!(k in parsed))
        throw new InvariantError(`Output AI tidak memuat bidang wajib: ${k}`);
    }
    const s = parsed.soal_augmentasi || {};
    const requiredInner = [
      "topic",
      "teks_soal",
      "pilihan_jawaban",
      "kunci_jawaban",
      "penjelasan_jawaban",
    ];
    for (const k of requiredInner) {
      if (!(k in s))
        throw new InvariantError(
          `Output AI tidak memuat bidang wajib: soal_augmentasi.${k}`
        );
    }

    const inputKeys = ["A", "B", "C", "D"].concat(
      original.option_e ? ["E"] : []
    );
    const outKeys = Object.keys(s.pilihan_jawaban || {});
    const same =
      inputKeys.length === outKeys.length &&
      inputKeys.every((k) => outKeys.includes(k));
    if (!same) {
      throw new InvariantError(
        `Jumlah/label pilihan jawaban tidak sama dengan input. Harus: ${inputKeys.join(
          ", "
        )}`
      );
    }

    const key = (s.kunci_jawaban || "").toUpperCase();
    if (!inputKeys.includes(key)) {
      throw new InvariantError(
        `kunci_jawaban harus salah satu dari ${inputKeys.join(", ")}`
      );
    }

    const bad = ["```", "```json"];
    const fieldsToCheck = [
      s.teks_soal,
      s.penjelasan_jawaban,
      ...inputKeys.map((k) => s.pilihan_jawaban[k]),
    ];
    if (
      fieldsToCheck.some(
        (v) => typeof v === "string" && bad.some((b) => v.includes(b))
      )
    ) {
      throw new InvariantError(
        "Output AI tidak boleh mengandung markdown fences (```)"
      );
    }

    return parsed;
  }

  async _generateAugmentation(original, targetLevel) {
    const model = this._genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const hasImage = !!original.image_url; // Cek apakah URL ada
    const imageContextCaption =
      original.image_caption || "Gambar yang relevan dengan topik soal.";

    const soalTarget = {
      text_soal: original.question_text,
      pilihan_jawaban_asli: {
        A: original.option_a,
        B: original.option_b,
        C: original.option_c,
        D: original.option_d,
        ...(original.option_e ? { E: original.option_e } : {}),
      },
      kunci_jawaban_asli: original.correct_answer,
      level_kognitif_asli: original.cognitive_level,
      level_kognitif_target: targetLevel,
      topic: original.topics.name,
      class_level: original.topics.class_level,
      // Kirim info gambar ke AI
      has_image: hasImage,
      image_context_description: hasImage
        ? imageContextCaption
        : "Tidak ada gambar",
    };

    const prompt = `
      Anda adalah seorang ahli pedagogi dan spesialis desain instruksional.
      Tugas: Augmentasi soal ke level kognitif ${targetLevel}.

      [DATA SOAL]
      ${JSON.stringify(soalTarget, null, 2)}

      [INSTRUKSI UTAMA - FORMAT PILIHAN GANDA (CRITICAL)]
      Masalah umum pada soal C5/C6 adalah opsi jawaban menjadi "Esai Mini" yang terlalu panjang. Anda HARUS menghindarinya.
      
      1. **LARANGAN "ESAI DALAM OPSI"**:
        - Opsi jawaban (A, B, C, D, E) HARUS SINGKAT, PADAT, dan JELAS.
        - **Maksimal 1-2 kalimat per opsi**.
        - DILARANG memasukkan kata-kata seperti "Justifikasi:", "Alasan:", atau penjelasan panjang di dalam teks opsi.
        - Penjelasan/Justifikasi lengkap HANYA boleh ditaruh di field "penjelasan_jawaban" JSON, BUKAN di opsi.

      2. **STRUKTUR C5/C6 YANG BENAR**:
        - Alihkan kompleksitas ke **Teks Soal (Stem)**. Buat skenario atau studi kasus di teks soal.
        - Opsi jawaban hanya berisi: **Keputusan Akhir**, **Kesimpulan**, atau **Tindakan Utama**.
        - Contoh SALAH (Terlalu Panjang): 
          A: "Saya memilih X karena X memiliki fitur Y yang menyebabkan Z..."
        - Contoh BENAR (Tepat):
          A: "Menggunakan bakteri bentuk Basil dengan agitasi moderat." (Penjelasan detailnya masuk ke pembahasan).

      3. **OBJEKTIVITAS**:
        - Hindari kata "Bagaimana pendapat Anda". Gunakan "Manakah pendekatan yang paling efektif berdasarkan prinsip X".

      4. **KONTEKS GAMBAR**:
        - Jika "has_image": true, pastikan soal merujuk pada gambar tersebut secara logis.

      5. **FORMAT PLAIN TEXT (SANGAT PENTING)**:
        - Output JSON **DILARANG KERAS** mengandung formatting Markdown di dalam value-nya.
        - **JANGAN** gunakan tanda bintang (**bold** atau * italic).
        - **JANGAN** gunakan bullet points simbol (* atau -).
        - Gunakan teks polos saja. Jika butuh poin, gunakan penomoran biasa (1., 2.) atau baris baru.

      [STRUKTUR OUTPUT JSON]
      {
        "level_kognitif": "${original.cognitive_level}",
        "level_kognitif_target": "${targetLevel}",
        "soal_augmentasi": {
          "topic": "Topik relevan",
          "class_level": ${original.topics.class_level}, 
          "teks_soal": "Skenario/Kasus lengkap. (Pastikan diakhiri dengan pertanyaan spesifik)",
          "pilihan_jawaban": {
            "A": "Keputusan/Jawaban singkat (Max 20 kata).",
            "B": "Keputusan/Jawaban singkat (Max 20 kata).",
            "C": "Keputusan/Jawaban singkat (Max 20 kata).",
            "D": "Keputusan/Jawaban singkat (Max 20 kata)."${
              original.option_e ? ',\n"E": "Keputusan/Jawaban singkat."' : ""
            }
          },
          "kunci_jawaban": "Kunci (misal: 'B').",
          "penjelasan_jawaban": "DISINI tempat Anda menulis justifikasi ilmiah lengkap dan analisis mendalam mengapa kunci jawaban benar dan yang lain salah."
        }
      }
      `.trim();

    const result = await model.generateContent(prompt);
    const raw =
      (result.response && result.response.text && result.response.text()) || "";

    const clean = raw
      .replace(/^\s*```json\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      const m = clean.match(/\{[\s\S]*\}$/);
      if (!m)
        throw new InvariantError(
          "Gagal parse respon dari Gemini (bukan JSON valid)."
        );
      parsed = JSON.parse(m[0]);
    }

    return this._validateAugmentedOutput(original, parsed);
  }

  async _saveAugmentedQuestion(original, augmented, created_by) {
    const soal = augmented.soal_augmentasi;

    const insertPayload = {
      topic_id: original.topic_id ?? null,
      version: "augmentasi",
      question_text: soal.teks_soal,
      option_a: soal.pilihan_jawaban.A,
      option_b: soal.pilihan_jawaban.B,
      option_c: soal.pilihan_jawaban.C,
      option_d: soal.pilihan_jawaban.D,
      option_e: soal.pilihan_jawaban.E ?? null,
      correct_answer: soal.kunci_jawaban,
      difficulty_level: original.difficulty_level ?? 2, // Default medium jika null
      cognitive_level: augmented.level_kognitif_target,
      parent_question_id: original.id,
      created_by,
      verification_status: "belum valid",
      notes: soal.penjelasan_jawaban ?? null,
      image_url: original.image_url ?? null,
      image_caption: original.image_caption ?? null,
    };

    const { data, error } = await this._supabase
      .from("questions")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error)
      throw new InvariantError(
        "Gagal menyimpan soal augmentasi: " + error.message
      );

    return data;
  }

  async saveAugment(questionId, targetLevel, created_by) {
    const original = await this._getQuestionById(questionId);
    const augmented = await this._generateAugmentation(original, targetLevel);
    const saved = await this._saveAugmentedQuestion(
      original,
      augmented,
      created_by
    );
    return {
      original_id: questionId,
      level_kognitif_original: original.cognitive_level,
      target_level: targetLevel,
      result: saved,
    };
  }
}
