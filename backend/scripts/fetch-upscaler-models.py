from __future__ import annotations

import sys
import urllib.request
from pathlib import Path


MODELS = {
    "RealESRGAN_x2plus.pth": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
    "RealESRGAN_x4plus.pth": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
}


def main() -> None:
    destination = Path(sys.argv[1]).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    for filename, url in MODELS.items():
        target = destination / filename
        if target.is_file() and target.stat().st_size > 1_000_000:
            print(f"Already downloaded: {filename}")
            continue
        temporary = target.with_suffix(".download")
        print(f"Downloading {filename}...")
        urllib.request.urlretrieve(url, temporary)
        temporary.replace(target)
        print(f"Saved: {target}")


if __name__ == "__main__":
    main()
