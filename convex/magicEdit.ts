'use node'

import OpenAI, { toFile } from 'openai'
import { v } from 'convex/values'
import { action, env } from './_generated/server'

const operationValidator = v.union(
  v.literal('remove'),
  v.literal('replace'),
  v.literal('retouch'),
)

export const edit = action({
  args: {
    imageId: v.id('_storage'),
    maskId: v.id('_storage'),
    referenceId: v.optional(v.id('_storage')),
    operation: operationValidator,
    instruction: v.string(),
  },
  returns: v.object({
    storageId: v.id('_storage'),
    url: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured. Run: pnpm exec convex env set OPENAI_API_KEY')
    }
    if (args.instruction.length > 1_500) {
      throw new Error('Edit instructions must be 1,500 characters or fewer')
    }

    const [image, mask, reference] = await Promise.all([
      ctx.storage.get(args.imageId),
      ctx.storage.get(args.maskId),
      args.referenceId ? ctx.storage.get(args.referenceId) : Promise.resolve(null),
    ])
    if (image === null || mask === null) throw new Error('The source image or selection mask is missing')
    if (args.operation === 'retouch' && reference === null) {
      throw new Error('The selected subject reference is missing. Select the subject again and retry.')
    }

    const instruction = args.instruction.trim()
    const prompt =
      args.operation === 'remove'
        ? `Remove the object inside the transparent masked area and reconstruct the background naturally. Preserve everything outside the mask exactly. ${instruction}`
        : args.operation === 'retouch'
          ? `Image 1 is the full source image to edit. Image 2 is an isolated reference of the exact selected subject from Image 1. Retouch only the transparent masked area in Image 1. The output must contain the same individual subject shown in Image 2, not a similar replacement. Preserve its species or breed, face, eyes, colors, markings, body proportions, texture, accessories, and every other identity-defining detail. Change only the requested pose or attribute, and do not add a second copy of the subject. Preserve everything outside the mask exactly. Requested change: ${instruction}`
          : `Replace only the transparent masked area as follows: ${instruction}. Preserve everything outside the mask exactly.`

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    const sourceFile = await toFile(image, 'source.png', { type: 'image/png' })
    const referenceFile = reference
      ? await toFile(reference, 'selected-subject-reference.png', { type: 'image/png' })
      : null
    const result = await openai.images.edit({
      model: 'gpt-image-2',
      image: referenceFile ? [sourceFile, referenceFile] : sourceFile,
      mask: await toFile(mask, 'mask.png', { type: 'image/png' }),
      prompt,
      quality: 'medium',
      output_format: 'png',
    })
    const encoded = result.data?.[0]?.b64_json
    if (!encoded) throw new Error('OpenAI returned no edited image')

    const output = new Blob([Buffer.from(encoded, 'base64')], { type: 'image/png' })
    const storageId = await ctx.storage.store(output)
    const url = await ctx.storage.getUrl(storageId)
    if (url === null) throw new Error('The edited image could not be stored')
    return { storageId, url }
  },
})
