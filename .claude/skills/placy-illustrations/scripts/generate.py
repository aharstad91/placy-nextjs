#!/usr/bin/env python3
"""
Generate watercolor illustrations in Placy's Wesselsløkka-akvarell style
using Gemini 3 Pro Image.

Sources GEMINI_API_KEY from .env.local if present, else from environment.

Usage:
    python3 generate.py \\
        --prompt "prompt text" \\
        --refs path1.jpg path2.png \\
        --out /path/to/output.jpg \\
        --aspect 16:9

    python3 generate.py --prompt-file prompt.txt --refs anchor.jpg --out out.jpg

Aspect ratios: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
Defaults: aspect=3:2
"""
import argparse
import os
import sys
from pathlib import Path


def load_env_local():
    """Source GEMINI_API_KEY from project .env.local if the env var is missing."""
    if os.environ.get("GEMINI_API_KEY"):
        return
    # Walk up from script location looking for .env.local
    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        candidate = parent / ".env.local"
        if candidate.exists():
            for line in candidate.read_text().splitlines():
                line = line.strip()
                if line.startswith("GEMINI_API_KEY=") and "GEMINI_API_KEY" not in os.environ:
                    os.environ["GEMINI_API_KEY"] = line.split("=", 1)[1].strip().strip('"').strip("'")
                    return


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prompt", help="Prompt text (inline)")
    parser.add_argument("--prompt-file", help="Path to file containing prompt text")
    parser.add_argument("--refs", nargs="*", default=[], help="Reference image paths (style anchors)")
    parser.add_argument("--out", required=True, help="Output .jpg path")
    parser.add_argument("--aspect", default="3:2", help="Aspect ratio (default: 3:2)")
    parser.add_argument("--model", default="gemini-3-pro-image-preview", help="Gemini model")
    args = parser.parse_args()

    if not args.prompt and not args.prompt_file:
        parser.error("Provide either --prompt or --prompt-file")

    if args.prompt_file:
        prompt = Path(args.prompt_file).read_text()
    else:
        prompt = args.prompt

    load_env_local()
    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("ERROR: GEMINI_API_KEY not found in env or .env.local")

    # Import lazily so --help works without SDK installed
    from google import genai
    from google.genai import types
    from PIL import Image

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    contents = [prompt]
    for ref_path in args.refs:
        if not Path(ref_path).exists():
            sys.exit(f"ERROR: Reference image not found: {ref_path}")
        contents.append(Image.open(ref_path))

    print(f"→ Model: {args.model}")
    print(f"→ Aspect: {args.aspect}")
    print(f"→ References: {len(args.refs)}")
    print(f"→ Output: {args.out}")

    response = client.models.generate_content(
        model=args.model,
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=args.aspect),
        ),
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    saved = False
    for part in response.parts:
        if part.text:
            print(f"Model note: {part.text[:300]}")
        elif part.inline_data:
            img = part.as_image()
            img.save(str(out_path))
            saved = True
            print(f"✓ Saved: {out_path}")

    if not saved:
        sys.exit("ERROR: Model returned no image")


if __name__ == "__main__":
    main()
