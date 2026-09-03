const fs = require("fs");
const path = require("path");
const { S3Client, HeadBucketCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

let s3Client = null;
let s3Ready = false;

const hasS3Env = () =>
  Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      process.env.AWS_S3_BUCKET
  );

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
    console.log(`Image storage: S3 (${process.env.AWS_S3_BUCKET})`);
  } catch (error) {
    s3Ready = false;
    console.log(`Image storage: local (S3 check failed: ${error.message})`);
  }
};

const storageMode = () => (s3Ready ? "s3" : "local");

const uniqueName = (originalName) => {
  const ext = path.extname(originalName || "").toLowerCase() || ".jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
};

const saveImage = async (file, folder = "products") => {
  if (!file?.buffer) return null;
  const filename = uniqueName(file.originalname);

  if (s3Ready) {
    const key = `${folder}/${filename}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
      })
    );
    const base =
      process.env.AWS_S3_PUBLIC_URL ||
      `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    return `${base.replace(/\/$/, "")}/${key}`;
  }

  const dir = path.join(__dirname, "..", "uploads", folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  const publicBase = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(
    /\/$/,
    ""
  );
  return `${publicBase}/uploads/${folder}/${filename}`;
};

module.exports = { initStorage, saveImage, storageMode };
