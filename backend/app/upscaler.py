from __future__ import annotations

import io
import time
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image, ImageOps, UnidentifiedImageError


MAX_IMAGE_BYTES = 20 * 1024 * 1024
MAX_OUTPUT_PIXELS = 40_000_000
MAX_OUTPUT_EDGE = 8_192
MODEL_DIRECTORY = Path(__file__).parent.parent / "models"
MODEL_PATHS = {
    2: MODEL_DIRECTORY / "RealESRGAN_x2plus.pth",
    4: MODEL_DIRECTORY / "RealESRGAN_x4plus.pth",
}

_models: dict[int, Any] = {}


def models_installed() -> bool:
    try:
        import spandrel  # noqa: F401
    except ImportError:
        return False
    return all(path.is_file() for path in MODEL_PATHS.values())


def model_loaded() -> bool:
    return bool(_models)


def _load_model(native_scale: int) -> Any:
    if native_scale in _models:
        return _models[native_scale]

    path = MODEL_PATHS[native_scale]
    if not path.is_file():
        raise RuntimeError("Real-ESRGAN models are missing; run pnpm setup:backend")

    try:
        from spandrel import ImageModelDescriptor, ModelLoader
    except ImportError as error:
        raise RuntimeError("The local upscaler is not installed; run pnpm setup:backend") from error

    descriptor = ModelLoader().load_from_file(path)
    if not isinstance(descriptor, ImageModelDescriptor):
        raise RuntimeError(f"{path.name} is not a supported image upscaler")
    if int(descriptor.scale) != native_scale:
        raise RuntimeError(f"{path.name} reported an unexpected {descriptor.scale}x scale")

    descriptor = descriptor.to("cuda").eval().half()
    _models[native_scale] = descriptor
    return descriptor


def _image_to_tensor(image: Image.Image) -> torch.Tensor:
    array = np.asarray(image, dtype=np.float32) / 255.0
    return torch.from_numpy(array).permute(2, 0, 1).unsqueeze(0)


def _run_tiled(model: Any, source: torch.Tensor, native_scale: int, tile_size: int) -> Image.Image:
    _, _, height, width = source.shape
    padding = 24
    output = np.empty((height * native_scale, width * native_scale, 3), dtype=np.uint8)

    with torch.inference_mode():
        for top in range(0, height, tile_size):
            bottom = min(top + tile_size, height)
            for left in range(0, width, tile_size):
                right = min(left + tile_size, width)
                padded_top = max(0, top - padding)
                padded_bottom = min(height, bottom + padding)
                padded_left = max(0, left - padding)
                padded_right = min(width, right + padding)

                tile = source[:, :, padded_top:padded_bottom, padded_left:padded_right].to(
                    device="cuda",
                    dtype=torch.float16,
                    non_blocking=True,
                )
                enhanced = model(tile).float().cpu()

                crop_top = (top - padded_top) * native_scale
                crop_bottom = crop_top + (bottom - top) * native_scale
                crop_left = (left - padded_left) * native_scale
                crop_right = crop_left + (right - left) * native_scale
                cropped = (
                    enhanced[:, :, crop_top:crop_bottom, crop_left:crop_right]
                    .squeeze(0)
                    .clamp_(0, 1)
                    .permute(1, 2, 0)
                    .mul_(255)
                    .round_()
                    .byte()
                    .numpy()
                )
                output[
                    top * native_scale:bottom * native_scale,
                    left * native_scale:right * native_scale,
                ] = cropped

    return Image.fromarray(output, mode="RGB")


def upscale_image(
    image_bytes: bytes,
    output_width: int,
    output_height: int,
    strength: float,
) -> tuple[bytes, dict[str, str]]:
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image must be 20 MB or smaller")
    if not 0.25 <= strength <= 1:
        raise ValueError("Restoration strength must be between 25% and 100%")
    if (
        output_width < 256
        or output_height < 256
        or output_width > MAX_OUTPUT_EDGE
        or output_height > MAX_OUTPUT_EDGE
        or output_width * output_height > MAX_OUTPUT_PIXELS
    ):
        raise ValueError("Requested output dimensions are unsupported")

    try:
        opened = Image.open(io.BytesIO(image_bytes))
        source = ImageOps.exif_transpose(opened)
        source.load()
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("Unsupported or invalid image") from error

    width, height = source.size
    expected_ratio = width / height
    output_ratio = output_width / output_height
    if abs(expected_ratio - output_ratio) / expected_ratio > 0.012:
        raise ValueError("Output dimensions must preserve the source aspect ratio")
    requested_scale = min(output_width / width, output_height / height)
    if requested_scale <= 1 or requested_scale > 4.01:
        raise ValueError("Choose an output scale greater than 1x and no more than 4x")
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable; the local upscaler requires the NVIDIA GPU")

    native_scale = 2 if requested_scale <= 3 else 4
    model = _load_model(native_scale)
    rgba = source.convert("RGBA")
    rgb = rgba.convert("RGB")
    input_tensor = _image_to_tensor(rgb)
    started = time.perf_counter()

    try:
        enhanced = _run_tiled(model, input_tensor, native_scale, tile_size=512)
    except torch.OutOfMemoryError:
        torch.cuda.empty_cache()
        enhanced = _run_tiled(model, input_tensor, native_scale, tile_size=256)

    if enhanced.size != (output_width, output_height):
        enhanced = enhanced.resize((output_width, output_height), Image.Resampling.LANCZOS)

    if strength < 0.995:
        baseline = rgb.resize((output_width, output_height), Image.Resampling.LANCZOS)
        enhanced = Image.blend(baseline, enhanced, strength)

    if "A" in rgba.getbands() and rgba.getchannel("A").getextrema() != (255, 255):
        alpha = rgba.getchannel("A").resize((output_width, output_height), Image.Resampling.LANCZOS)
        enhanced.putalpha(alpha)

    output = io.BytesIO()
    save_options: dict[str, Any] = {"format": "PNG", "compress_level": 3}
    icc_profile = opened.info.get("icc_profile")
    if isinstance(icc_profile, bytes):
        save_options["icc_profile"] = icc_profile
    enhanced.save(output, **save_options)
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    return output.getvalue(), {
        "X-Image-Width": str(output_width),
        "X-Image-Height": str(output_height),
        "X-Upscale-Model": f"RealESRGAN-x{native_scale}plus",
        "X-Processing-Time-Ms": str(elapsed_ms),
    }
