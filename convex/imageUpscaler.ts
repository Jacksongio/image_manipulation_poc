'use node'

import OpenAI, { toFile } from 'openai'
import { v } from 'convex/values'
import { action, env } from './_generated/server'

const scaleValidator = v.union(v.literal(2), v.literal(4))
const mimeTypeValidator = v.union(
  v.literal('image/png'),
  v.literal('image/jpeg'),
  v.literal('image/webp'),
)

export const upscale = action({
  args: {
    imageId: v.id('_storage'),
    scale: scaleValidator,
    mimeType: mimeTypeValidator,
    outputWidth: v.number(),
    outputHeight: v.number(),
  },
  returns: v.object({
    storageId: v.id('_storage'),
    url: v.string(),
    width: v.number(),
    height: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured. Run: pnpm exec convex env set OPENAI_API_KEY')
    }

    const { outputWidth: width, outputHeight: height } = args
    const ratio = width / height
    const validSize =
      Number.isInteger(width) &&
      Number.isInteger(height) &&
      width >= 256 &&
      height >= 256 &&
      width <= 3_840 &&
      height <= 3_840 &&
      width % 16 === 0 &&
      height % 16 === 0 &&
      width * height <= 3_840 * 2_160 &&
      ratio >= 1 / 3 &&
      ratio <= 3
    if (!validSize) throw new Error('The requested output dimensions are not supported')

    const image = await ctx.storage.get(args.imageId)
    if (image === null) throw new Error('The source image is missing. Upload it again and retry.')

    const prompt = `Upscale and restore this exact source image at ${args.scale}x resolution. Produce a clean, high-resolution version with naturally recovered fine detail, crisp but realistic edges, reduced compression artifacts, reduced pixelation, controlled noise, and accurate texture.

This is restoration and resolution enhancement only, not a redesign or creative edit. Preserve the exact identity of every person or animal, facial features, expressions, text, logos, colors, lighting, pose, anatomy, clothing, markings, object count, camera angle, crop, perspective, composition, and background. Do not add, remove, replace, beautify, restyle, or reposition anything. Avoid plastic skin, halos, oversharpening, invented text, and artificial detail.`

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    const extension = args.mimeType === 'image/jpeg' ? 'jpg' : args.mimeType.split('/')[1]
    const result = await openai.images.edit({
      model: 'gpt-image-2',
      image: await toFile(image, `low-resolution-source.${extension}`, { type: args.mimeType }),
      prompt,
      quality: 'high',
      size: `${width}x${height}`,
      output_format: 'png',
    })
    const encoded = result.data?.[0]?.b64_json
    if (!encoded) throw new Error('OpenAI returned no upscaled image')

    const output = new Blob([Buffer.from(encoded, 'base64')], { type: 'image/png' })
    const storageId = await ctx.storage.store(output)
    const url = await ctx.storage.getUrl(storageId)
    if (url === null) throw new Error('The upscaled image could not be stored')
    return { storageId, url, width, height }
  },
})
