import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  size: number;
}

async function getVideoInfo(inputPath: string): Promise<VideoInfo> {
  const { stdout } = await execAsync(
    `ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`
  );
  const probe = JSON.parse(stdout);
  const videoStream = probe.streams?.find((s: any) => s.codec_type === "video");
  return {
    duration: parseFloat(probe.format?.duration || "0"),
    width: videoStream?.width || 0,
    height: videoStream?.height || 0,
    size: parseInt(probe.format?.size || "0"),
  };
}

type AspectRatio = "16:9" | "9:16" | "1:1";

function getScaleFilter(info: VideoInfo): string {
  const maxDim = 1280;
  if (info.width > maxDim || info.height > maxDim) {
    if (info.width >= info.height) {
      return `scale=${maxDim}:-2`;
    } else {
      return `scale=-2:${maxDim}`;
    }
  }
  return "";
}

interface OptimizeOptions {
  aspectRatio?: AspectRatio;
  maxDuration?: number;
  generatePoster?: boolean;
}

interface OptimizeResult {
  buffer: Buffer;
  mimeType: string;
  posterBuffer?: Buffer;
  posterMimeType?: string;
}

export async function optimizeVideo(
  inputBuffer: Buffer,
  originalName: string,
  options: OptimizeOptions = {}
): Promise<OptimizeResult> {
  const { maxDuration = 30, generatePoster = false } = options;
  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const ext = path.extname(originalName).toLowerCase();
  const inputPath = path.join(tmpDir, `input_${timestamp}${ext}`);
  const outputPath = path.join(tmpDir, `output_${timestamp}.mp4`);
  const posterPath = path.join(tmpDir, `poster_${timestamp}.jpg`);

  try {
    await fs.promises.writeFile(inputPath, inputBuffer);

    const info = await getVideoInfo(inputPath);

    if (info.duration > maxDuration) {
      throw new Error(`Видео слишком длинное. Максимум ${maxDuration} секунд.`);
    }

    const filters: string[] = [];

    const scaleFilter = getScaleFilter(info);
    if (scaleFilter) filters.push(scaleFilter);

    const vfArg = filters.length > 0 ? `-vf "${filters.join(",")}"` : "";

    const targetBitrate = "1500k";
    const audioBitrate = "128k";
    const clipDuration = Math.min(info.duration, maxDuration);

    await execAsync(
      `ffmpeg -y -i "${inputPath}" ` +
      `-c:v libx264 -preset fast -b:v ${targetBitrate} -maxrate ${targetBitrate} -bufsize 3000k ` +
      `${vfArg} ` +
      `-c:a aac -b:a ${audioBitrate} ` +
      `-movflags +faststart ` +
      `-t ${clipDuration} ` +
      `"${outputPath}"`,
      { timeout: 120000 }
    );

    const outputBuffer = await fs.promises.readFile(outputPath);

    let posterBuffer: Buffer | undefined;
    let posterMimeType: string | undefined;

    if (generatePoster) {
      const posterTime = Math.min(0.5, clipDuration / 2);
      const posterFilters: string[] = [];
      const pScaleFilter = getScaleFilter(info);
      if (pScaleFilter) posterFilters.push(pScaleFilter);
      const posterVf = posterFilters.length > 0 ? `-vf "${posterFilters.join(",")}"` : "";

      await execAsync(
        `ffmpeg -y -i "${inputPath}" -ss ${posterTime} -frames:v 1 ${posterVf} -q:v 2 "${posterPath}"`,
        { timeout: 30000 }
      );

      posterBuffer = await fs.promises.readFile(posterPath);
      posterMimeType = "image/jpeg";
    }

    return {
      buffer: outputBuffer,
      mimeType: "video/mp4",
      posterBuffer,
      posterMimeType,
    };
  } finally {
    try { await fs.promises.unlink(inputPath); } catch {}
    try { await fs.promises.unlink(outputPath); } catch {}
    try { await fs.promises.unlink(posterPath); } catch {}
  }
}
