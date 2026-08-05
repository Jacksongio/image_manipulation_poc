from __future__ import annotations


STYLE_DIRECTIONS = {
    "watercolor": "a refined watercolor painting on cold-pressed paper, with translucent pigment washes, gentle color blooms, delicate wet-on-wet edges, and visible paper grain",
    "oil-painting": "a richly layered oil painting on canvas, with dimensional brushwork, nuanced color mixing, soft glazing, and tasteful impasto highlights",
    "pencil-sketch": "an elegant graphite pencil illustration on lightly textured ivory paper, with precise contour drawing, natural cross-hatching, and expressive tonal shading",
    "pop-art": "a bold 1960s-inspired pop-art print, with crisp graphic shapes, vibrant limited colors, halftone texture, and confident ink outlines",
    "anime": "a polished cinematic anime illustration, with clean expressive linework, cel-shaded color, carefully rendered features, and atmospheric lighting",
    "impressionist": "an impressionist painting with luminous broken color, lively visible brushstrokes, soft edges, and an emphasis on light and atmosphere",
    "storybook": "a warm, sophisticated storybook illustration, with hand-painted gouache texture, charming simplified detail, rich color, and gentle whimsical lighting",
    "vintage-poster": "a premium vintage travel-poster illustration, with screen-printed texture, simplified geometric forms, restrained retro colors, and subtle paper patina",
}

INTENSITY_DIRECTIONS = {
    "subtle": "Keep the rendering restrained and retain more of the source image’s natural detail.",
    "balanced": "Apply the artistic medium clearly while maintaining an immediately recognizable, faithful source image.",
    "bold": "Use expressive, unmistakable characteristics of the medium while still preserving every important source detail and identity.",
}


def art_style_prompt(style: str, intensity: str) -> str:
    return f"""Transform the provided source image into {STYLE_DIRECTIONS[style]}. {INTENSITY_DIRECTIONS[intensity]}

This is a faithful style transfer, not a new composition. Preserve the exact subjects and their identities, facial features, expressions, pose, anatomy, proportions, clothing, markings, object count, camera angle, crop, perspective, spatial layout, and background content. Do not add, remove, replace, or reposition anything. Change only the artistic rendering medium. The finished artwork should fill the canvas with no frame, border, caption, signature, or watermark."""


def upscale_prompt(scale: int) -> str:
    return f"""Upscale and restore this exact source image at {scale}x resolution. Produce a clean, high-resolution version with naturally recovered fine detail, crisp but realistic edges, reduced compression artifacts, reduced pixelation, controlled noise, and accurate texture.

This is restoration and resolution enhancement only, not a redesign or creative edit. Preserve the exact identity of every person or animal, facial features, expressions, text, logos, colors, lighting, pose, anatomy, clothing, markings, object count, camera angle, crop, perspective, composition, and background. Do not add, remove, replace, beautify, restyle, or reposition anything. Avoid plastic skin, halos, oversharpening, invented text, and artificial detail."""


def border_prompt(orientation: str, print_size: str, width: int, height: int) -> str:
    return f"""Using this one provided photograph as the source, outpaint it into a {orientation} {print_size}-inch composition. Imagine what naturally exists beyond the original image boundaries and extend the camera's field of view outward.

Keep the complete original scene centered and visually unchanged: the same people and animals, exact identities and faces, poses, clothing, objects, room layout, lighting, colors, perspective, camera position, and focal length. Create only the plausible surroundings beyond the original frame.

This must be one coherent photographic render. Do not stretch, squash, zoom, crop, tile, mirror, clone, duplicate, splice, stitch, paste side panels, blur-fill, or repeat any part of the source. Do not create overlapping copies or ghosted versions of windows, furniture, people, animals, or other objects. Continue lines, surfaces, textures, shadows, and reflections naturally into the imagined area with no seams or boundary marks.

Leave generous newly imagined space around the source so the result can be safely center-cropped to exactly {width} × {height} pixels for the final {print_size} print. Return only the expanded edge-to-edge photograph."""


def magic_edit_prompt(operation: str, instruction: str) -> str:
    selection_contract = """STRICT LOCAL EDIT CONTRACT:
- Image 1 is the original source image and must remain the basis of the output.
- Image 2 is the SAM3 segmentation mask aligned exactly with Image 1.
- WHITE mask pixels are the only editable region. BLACK mask pixels are locked and immutable.
- Perform only the requested change and confine it to the white region.
- Copy every black-mask region from Image 1 into the output unchanged, pixel-for-pixel. Do not regenerate, reinterpret, retouch, color-grade, relight, sharpen, blur, move, crop, resize, or restyle any locked region.
- Keep the original canvas dimensions, aspect ratio, crop, camera position, composition, background, lighting, colors, textures, shadows, people, objects, and spatial layout unchanged outside the white region.
- Do not make any unrequested improvement or incidental change.
- Blend only the immediate selection boundary as minimally as needed to avoid a visible seam; never let the edit spread beyond the mask.
- If the requested change conflicts with these constraints, preserve the locked region rather than altering it."""
    if operation == "remove":
        return f"""{selection_contract}

Remove the object inside the white SAM3 selection completely, then reconstruct the newly exposed area as a seamless continuation of the real background visible around the selection. Infer the hidden background from all surrounding context and match its perspective, geometry, depth, lighting, shadows, reflections, colors, texture, detail, focus, and image grain. The result must look as though the selected object was never present: no empty or transparent area, blur patch, smudge, repeated texture, halo, ghosting, outline, hard edge, or visible mask boundary. Reconstruct only within the white selection and preserve the locked black region exactly. Additional guidance: {instruction or 'None.'}

Return Image 1 with only the selected object removed. Everything outside the white mask must remain exactly the same."""
    if operation == "retouch":
        return f"""{selection_contract}

Image 3 is an isolated reference of the exact subject selected by SAM3. Apply this requested change only within the white selection: {instruction}

Keep the exact same individual shown in Image 3—not a similar replacement. Preserve its species or breed, face, eyes, colors, markings, body proportions, texture, accessories, and all identity-defining details unless the requested change explicitly targets one of those traits. Do not add another copy of the subject.

Return Image 1 with only the requested change inside the white mask. Everything outside the white mask must remain exactly the same."""
    return f"""{selection_contract}

Replace only the content inside the white SAM3 selection with the following: {instruction}

Return Image 1 with only the white-mask content replaced. Everything outside the white mask must remain exactly the same."""
