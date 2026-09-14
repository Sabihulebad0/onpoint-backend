const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

let s3Client = null;
let s3Ready = false;

const hasS3Env = () =>
  Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      process.env.AWS_S3_BUCKET
  );

const publicBase = () =>
  (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, "");

const cdnBase = () => (process.env.AWS_S3_PUBLIC_URL || "").replace(/\/$/, "");

const initStorage = async () => {
  if (!hasS3Env()) {
    s3Ready = false;
    console.log("Image storage: local (S3 is not configured)");
    return;
  }

  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: process.env.AWS_S3_BUCKET }));
    s3Ready = true;
    console.log(`Image storage: S3 (${process.env.AWS_S3_BUCKET}, private proxy)`);
  } catch (error) {
    s3Ready = false;
    console.log(`Image storage: S3 client created, HeadBucket failed (${error.message}). Uploads will still try PutObject.`);
  }
};

const storageMode = () => (s3Ready ? "s3" : "local");

const uniqueName = (originalName) => {
  const ext = path.extname(originalName || "").toLowerCase() || ".jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
};

const encodeKey = (key) =>
  String(key)
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

const isS3Host = (host) =>
  /(^|\.)s3([.-]|$)/i.test(host) ||
  /s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(host) ||
  /^s3\.amazonaws\.com$/i.test(host) ||
  /\.s3-website[.-]/i.test(host);

const s3KeyFromUrl = (value) => {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || /^(data:|blob:)/i.test(trimmed)) return "";
  if (/unsplash\.com/i.test(trimmed)) return "";
  const bucket = String(process.env.AWS_S3_BUCKET || "").toLowerCase();

  const mediaMatch = trimmed.match(/\/api\/media\/(.+?)(?:\?|#|$)/i);
  if (mediaMatch) {
    try {
      return decodeURIComponent(mediaMatch[1]);
    } catch {
      return mediaMatch[1];
    }
  }

  if (trimmed.startsWith("s3://")) {
    const rest = trimmed.slice(5);
    const slash = rest.indexOf("/");
    return slash >= 0 ? rest.slice(slash + 1) : "";
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const virtualHost =
      bucket &&
      (host === `${bucket}.s3.amazonaws.com` ||
        host.startsWith(`${bucket}.s3.`) ||
        host.startsWith(`${bucket}.s3-`));
    if (virtualHost) return pathname;
    if (isS3Host(host) && bucket && (pathname === bucket || pathname.startsWith(`${bucket}/`))) {
      return pathname.slice(bucket.length).replace(/^\/+/, "");
    }
    if (isS3Host(host)) return pathname;
  } catch {
    // relative path / object key
  }

  if (/^(products|categories|coupons)\//i.test(trimmed.replace(/^\/+/, ""))) {
    return trimmed.replace(/^\/+/, "");
  }

  return "";
};

const publicCdn = () => {
  const cdn = cdnBase();
  if (!cdn) return "";
  // Private S3 origins must never be sent to the browser.
  if (/amazonaws\.com/i.test(cdn) || /s3[.-]/i.test(cdn)) return "";
  return cdn;
};

const publicImageUrl = (value) => {
  const key = s3KeyFromUrl(value);
  if (!key) return value;
  const cdn = publicCdn();
  if (cdn) return `${cdn}/${encodeKey(key)}`;
  return `${publicBase()}/api/media/${encodeKey(key)}`;
};

const rewriteResponseMedia = (value, seen = new WeakSet()) => {
  if (typeof value === "string") return publicImageUrl(value);
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (value._bsontype === "ObjectId" || typeof value.toHexString === "function") {
    return String(value);
  }
  if (value._bsontype) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => rewriteResponseMedia(item, seen));

  const proto = Object.getPrototypeOf(value);
  const isPlain = proto === Object.prototype || proto === null;
  if (!isPlain && typeof value.toJSON === "function") {
    return rewriteResponseMedia(value.toJSON(), seen);
  }
  if (!isPlain) return value;

  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key] = rewriteResponseMedia(nested, seen);
  }
  return out;
};

const ensureS3Client = () => {
  if (s3Client) return s3Client;
  if (!hasS3Env()) return null;
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return s3Client;
};

const saveImage = async (file, folder = "products", options = {}) => {
  if (!file?.buffer) return null;
  const filename = uniqueName(file.originalname || `${folder}.jpg`);
  const key = `${folder}/${filename}`;
  const requireS3 = Boolean(options.requireS3 || folder === "custom");
  const client = ensureS3Client();

  if (client) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "image/jpeg",
        })
      );
      s3Ready = true;
      return publicImageUrl(`s3://${process.env.AWS_S3_BUCKET}/${key}`);
    } catch (error) {
      if (requireS3) {
        error.statusCode = 503;
        error.message = `Could not save image to S3: ${error.message}`;
        throw error;
      }
      console.log(`S3 upload failed, using local file: ${error.message}`);
    }
  }

  if (requireS3) {
    const error = new Error("S3 is not configured. Custom designs must be stored in S3.");
    error.statusCode = 503;
    throw error;
  }

  const dir = path.join(__dirname, "..", "uploads", folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return `${publicBase()}/uploads/${folder}/${filename}`;
};

const isSafeKey = (key) => Boolean(key) && !key.includes("..") && !path.isAbsolute(key) && !key.includes("\\");

const streamMedia = async (req, res, next) => {
  try {
    const captured = req.params[0] || req.params.key || "";
    const fromUrl = String(captured || req.originalUrl || req.path || "")
      .split("?")[0]
      .replace(/^\/api\/media\/?/i, "")
      .replace(/^\/+/, "");
    let key = fromUrl;
    try {
      key = decodeURIComponent(fromUrl);
    } catch {
      key = fromUrl;
    }
    if (!isSafeKey(key)) {
      return res.status(400).json({ message: "Invalid media key" });
    }
    const client = ensureS3Client();
    if (!client) {
      return res.status(503).json({ message: "S3 storage is not available" });
    }

    const result = await client.send(
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      })
    );

    res.setHeader("Content-Type", result.ContentType || "application/octet-stream");
    if (result.ContentLength) res.setHeader("Content-Length", String(result.ContentLength));
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    const body = result.Body;
    if (req.method === "HEAD") {
      return res.end();
    }
    if (body && typeof body.pipe === "function") {
      body.pipe(res);
      return;
    }
    if (body?.transformToWebStream) {
      Readable.fromWeb(body.transformToWebStream()).pipe(res);
      return;
    }
    const bytes = await body.transformToByteArray();
    res.end(Buffer.from(bytes));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NoSuchKey") {
      return res.status(404).json({ message: "Image not found" });
    }
    if (error?.$metadata?.httpStatusCode === 403 || error?.name === "AccessDenied") {
      return res.status(403).json({
        message: "S3 denied access. The IAM user needs s3:GetObject on this private bucket.",
      });
    }
    next(error);
  }
};

module.exports = {
  initStorage,
  saveImage,
  storageMode,
  publicImageUrl,
  rewriteResponseMedia,
  streamMedia,
};
