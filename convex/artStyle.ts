'use node'

import OpenAI, { toFile } from 'openai'
import { v } from 'convex/values'
import { action, env } from './_generated/server'

const styleValidator = v.union(
  v.literal('watercolor'),
  v.literal('oil-painting'),
  v.literal('pencil-sketch'),
  v.literal('pop-art'),
  v.literal('anime'),
  v.literal('impressionist'),
  v.literal('storybook'),
  v.literal('vintage-poster'),
)

const intensityValidator = v.union(
  v.literal('subtle'),
  v.literal('balanced'),
  v.literal('bold'),
)

const STYLE_DIRECTIONS = {
  watercolor: 'a refined watercolor painting on cold-pressed paper, with translucent pigment washes, gentle color blooms, delicate wet-on-wet edges, and visible paper grain',
  'oil-painting': 'a richly layered oil painting on canvas, with dimensional brushwork, nuanced color mixing, soft glazing, and tasteful impasto highlights',
  'pencil-sketch': 'an elegant graphite pencil illustration on lightly textured ivory paper, with precise contour drawing, natural cross-hatching, and expressive tonal shading',
  'pop-art': 'a bold 1960s-inspired pop-art print, with crisp graphic shapes, vibrant limited colors, halftone texture, and confident ink outlines',
  anime: 'a polished cinematic anime illustration, with clean expressive linework, cel-shaded color, carefully rendered features, and atmospheric lighting',
  impressionist: 'an impressionist painting with luminous broken color, lively visible brushstrokes, soft edges, and an emphasis on light and atmosphere',
  storybook: 'a warm, sophisticated storybook illustration, with hand-painted gouache texture, charming simplified detail, rich color, and gentle whimsical lighting',
  'vintage-poster': 'a premium vintage travel-poster illustration, with screen-printed texture, simplified geometric forms, restrained retro colors, and subtle paper patina',
} as const

const INTENSITY_DIRECTIONS = {
  subtle: 'Keep the rendering restrained and retain more of the source image’s natural detail.',
  balanced: 'Apply the artistic medium clearly while maintaining an immediately recognizable, faithful source image.',
  bold: 'Use expressive, unmistakable characteristics of the medium while still preserving every important source detail and identity.',
} as const

export const transform = action({
  args: {
    imageId: v.id('_storage'),
    style: styleValidator,
    intensity: intensityValidator,
  },
  returns: v.object({
    storageId: v.id('_storage'),
    url: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured. Run: pnpm exec convex env set OPENAI_API_KEY')
    }

    const image = await ctx.storage.get(args.imageId)
    if (image === null) throw new Error('The source image is missing. Upload it again and retry.')

    const prompt = `Transform the provided source image into ${STYLE_DIRECTIONS[args.style]}. ${INTENSITY_DIRECTIONS[args.intensity]}

This is a faithful style transfer, not a new composition. Preserve the exact subjects and their identities, facial features, expressions, pose, anatomy, proportions, clothing, markings, object count, camera angle, crop, perspective, spatial layout, and background content. Do not add, remove, replace, or reposition anything. Change only the artistic rendering medium. The finished artwork should fill the canvas with no frame, border, caption, signature, or watermark.`

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    const result = await openai.images.edit({
      model: 'gpt-image-2',
      image: await toFile(image, 'source.png', { type: 'image/png' }),
      prompt,
      quality: 'medium',
      output_format: 'png',
    })
    const encoded = result.data?.[0]?.b64_json
    if (!encoded) throw new Error('OpenAI returned no styled image')

    const output = new Blob([Buffer.from(encoded, 'base64')], { type: 'image/png' })
    const storageId = await ctx.storage.store(output)
    const url = await ctx.storage.getUrl(storageId)
    if (url === null) throw new Error('The styled image could not be stored')
    return { storageId, url }
  },
})
