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

export async function optimizeVideo(inputBuffer: Buffer, originalName: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const ext = path.extname(originalName).toLowerCase();
  const inputPath = path.join(tmpDir, `input_${timestamp}${ext}`);
  const outputPath = path.join(tmpDir, `output_${timestamp}.mp4`);

  try {
    await fs.promises.writeFile(inputPath, inputBuffer);

    const info = await getVideoInfo(inputPath);

    if (info.duration > 15) {
      throw new Error("Видео слишком длинное. Максимум 15 секунд.");
    }

    const maxWidth = 1280;
    const needsResize = info.width > maxWidth;
    const scaleFilter = needsResize ? `-vf "scale=${maxWidth}:-2"` : "";

    const targetBitrate = "1500k";
    const audioBitrate = "128k";

    await execAsync(
      `ffmpeg -y -i "${inputPath}" ` +
      `-c:v libx264 -preset fast -b:v ${targetBitrate} -maxrate ${targetBitrate} -bufsize 3000k ` +
      `${scaleFilter} ` +
      `-c:a aac -b:a ${audioBitrate} ` +
      `-movflags +faststart ` +
      `-t 7 ` +
      `"${outputPath}"`,
      { timeout: 60000 }
    );

    const outputBuffer = await fs.promises.readFile(outputPath);
    return { buffer: outputBuffer, mimeType: "video/mp4" };
  } finally {
    try { await fs.promises.unlink(inputPath); } catch {}
    try { await fs.promises.unlink(outputPath); } catch {}
  }
}
