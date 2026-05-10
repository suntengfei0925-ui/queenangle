const fs = require("node:fs");
const path = require("node:path");
const multer = require("multer");
const { createId } = require("../db/localDb");

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeExtension(file) {
  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/jpeg") return ".jpg";
  if (file.mimetype === "image/webp") return ".webp";
  return path.extname(file.originalname || "").toLowerCase() || ".bin";
}

function createFileRoutes({ config, localDb }) {
  const signatureDir = path.join(config.uploadDir, "signatures");
  ensureDir(signatureDir);

  const storage = multer.diskStorage({
    destination(req, file, cb) {
      cb(null, signatureDir);
    },
    filename(req, file, cb) {
      cb(null, `${createId()}${safeExtension(file)}`);
    }
  });

  const upload = multer({
    storage,
    limits: {
      files: 1,
      fileSize: 2 * 1024 * 1024
    },
    fileFilter(req, file, cb) {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new Error("只允许上传 PNG、JPG 或 WebP 图片"));
      }
      return cb(null, true);
    }
  });

  async function uploadSignature(req, res) {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: "缺少签名图片" });
    }

    const relativePath = path.relative(config.uploadDir, file.path).replace(/\\/g, "/");
    const addRes = await localDb.collection("uploaded_files").add({
      data: {
        purpose: "signature",
        originalName: file.originalname || "",
        filename: file.filename,
        relativePath,
        mimeType: file.mimetype,
        size: file.size,
        createdByUserId: req.user.id,
        createdAt: localDb.serverDate()
      }
    });

    return res.json({
      ok: true,
      data: {
        fileId: addRes._id,
        signatureFileId: addRes._id,
        url: `/api/files/${addRes._id}`
      }
    });
  }

  async function sendFile(req, res) {
    let record;
    try {
      const result = await localDb.collection("uploaded_files").doc(req.params.id).get();
      record = result.data;
    } catch (err) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "文件不存在" });
    }

    const fullPath = path.resolve(config.uploadDir, record.relativePath || "");
    const uploadRoot = path.resolve(config.uploadDir);
    if (!fullPath.startsWith(uploadRoot) || !fs.existsSync(fullPath)) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "文件不存在" });
    }

    res.type(record.mimeType || "application/octet-stream");
    return res.sendFile(fullPath);
  }

  return {
    upload,
    uploadSignature,
    sendFile
  };
}

module.exports = {
  createFileRoutes
};
