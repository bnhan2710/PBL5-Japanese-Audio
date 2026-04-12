"""Audio utilities for merging and processing audio files"""

import logging
import subprocess
import tempfile
from typing import List
from urllib.request import urlopen

logger = logging.getLogger(__name__)


async def merge_audio_files(
    audio_urls: List[str],
    silence_duration: int = 3,
) -> bytes:
    """
    Merge multiple audio files with silence gaps between them.

    Args:
        audio_urls: List of audio file URLs to merge
        silence_duration: Duration of silence gap in seconds (default: 3)

    Returns:
        Merged audio file as bytes

    Uses ffmpeg to:
    1. Download each audio file
    2. Normalize all files to a common WAV format
    3. Generate silence segments in the same format
    4. Concatenate and encode output with built-in AAC encoder
    5. Return merged audio
    """
    try:
        if not audio_urls:
            raise ValueError("No audio URLs provided")

        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as tmpdir:
            # Step 1: Download all audio files
            downloaded_files = []

            for idx, url in enumerate(audio_urls):
                logger.info(f"Downloading audio {idx + 1}/{len(audio_urls)}: {url}")

                try:
                    # Download audio file
                    response = urlopen(url, timeout=30)
                    audio_data = response.read()
                    audio_path = f"{tmpdir}/audio_{idx}.m4a"

                    with open(audio_path, "wb") as f:
                        f.write(audio_data)

                    downloaded_files.append(audio_path)

                except Exception as e:
                    logger.error(f"Error downloading audio from {url}: {str(e)}")
                    raise

            # Step 2: Normalize each downloaded file to consistent WAV format
            normalized_files = []
            for idx, src_path in enumerate(downloaded_files):
                normalized_path = f"{tmpdir}/normalized_{idx}.wav"
                normalize_cmd = [
                    "ffmpeg",
                    "-y",
                    "-i",
                    src_path,
                    "-ar",
                    "44100",
                    "-ac",
                    "1",
                    "-c:a",
                    "pcm_s16le",
                    normalized_path,
                ]

                result = subprocess.run(
                    normalize_cmd,
                    capture_output=True,
                    text=True,
                    timeout=120,
                )

                if result.returncode != 0:
                    logger.error(f"FFmpeg normalize error for {src_path}: {result.stderr}")
                    raise RuntimeError(f"Failed to normalize input audio: {result.stderr}")

                normalized_files.append(normalized_path)

            # Step 3: Generate silence file in same WAV format
            silence_path = f"{tmpdir}/silence.wav"
            logger.info(f"Generating {silence_duration}s silence gap...")

            silence_cmd = [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=44100:cl=mono",
                "-t",
                str(silence_duration),
                "-ar",
                "44100",
                "-ac",
                "1",
                "-c:a",
                "pcm_s16le",
                silence_path,
            ]

            result = subprocess.run(
                silence_cmd,
                capture_output=True,
                text=True,
                timeout=60,
            )

            if result.returncode != 0:
                logger.error(f"FFmpeg silence generation error: {result.stderr}")
                raise RuntimeError(f"Failed to generate silence: {result.stderr}")

            # Step 4: Build concatenation list with silence between files
            final_concat_list = []
            for idx, audio_file in enumerate(normalized_files):
                final_concat_list.append(f"file '{audio_file}'")
                # Add silence after each file except the last one
                if idx < len(normalized_files) - 1:
                    final_concat_list.append(f"file '{silence_path}'")

            concat_file = f"{tmpdir}/concat.txt"
            with open(concat_file, "w") as f:
                f.write("\n".join(final_concat_list))

            logger.info(f"Concatenation list created with {len(normalized_files)} audio files")

            # Step 5: Merge all files and encode using built-in AAC encoder
            output_path = f"{tmpdir}/merged.m4a"
            logger.info("Starting audio merge with ffmpeg...")

            merge_cmd = [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                concat_file,
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                output_path,
            ]

            result = subprocess.run(
                merge_cmd,
                capture_output=True,
                text=True,
                timeout=600,
            )

            if result.returncode != 0:
                logger.error(f"FFmpeg merge error: {result.stderr}")
                raise RuntimeError(f"Failed to merge audio files: {result.stderr}")

            # Step 6: Read merged audio
            with open(output_path, "rb") as f:
                merged_audio = f.read()

            logger.info(
                f"Audio merge completed successfully. "
                f"Merged {len(audio_urls)} files with {silence_duration}s gaps. "
                f"Output size: {len(merged_audio)} bytes"
            )

            return merged_audio

    except Exception as e:
        logger.error(f"Error merging audio files: {str(e)}")
        raise
