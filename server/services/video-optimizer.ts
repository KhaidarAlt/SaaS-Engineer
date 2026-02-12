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

function getAspectCropFilter(info: VideoInfo, targetAspect: AspectRatio): string {
  const [tw, th] = targetAspect.split(":").map(Number);
  const targetRatio = tw / th;
  const currentRatio = info.width / info.height;

  if (Math.abs(currentRatio - targetRatio) < 0.05) {
    return "";
  }

  if (currentRatio > targetRatio) {
    const newWidth = Math.round(info.height * targetRatio);
    const cropW = newWidth % 2 === 0 ? newWidth : newWidth - 1;
    const cropH = info.height % 2 === 0 ? info.height : info.height - 1;
    const x = Math.round((info.width - cropW) / 2);
    return `crop=${cropW}:${cropH}:${x}:0`;
  } else {
    const newHeight = Math.round(info.width / targetRatio);
    const cropW = info.width % 2 === 0 ? info.width : info.width - 1;
    const cropH = newHeight % 2 === 0 ? newHeight : newHeight - 1;
    const y = Math.round((info.height - cropH) / 2);
    return `crop=${cropW}:${cropH}:0:${y}`;
  }
}

function getScaleFilter(info: VideoInfo, targetAspect: AspectRatio): string {
  let maxDim = 1280;
  if (targetAspect === "9:16") {
    if (info.height > maxDim) return `scale=-2:${maxDim}`;
  } else {
    if (info.width > maxDim) return `scale=${maxDim}:-2`;
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
  const { aspectRatio, maxDuration = 30, generatePoster = false } = options;
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

    if (aspectRatio) {
      const cropFilter = getAspectCropFilter(info, aspectRatio);
      if (cropFilter) filters.push(cropFilter);
    }

    const scaleFilter = getScaleFilter(info, aspectRatio || "16:9");
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
      if (aspectRatio) {
        const cropFilter = getAspectCropFilter(info, aspectRatio);
        if (cropFilter) posterFilters.push(cropFilter);
      }
      const pScaleFilter = getScaleFilter(info, aspectRatio || "16:9");
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
