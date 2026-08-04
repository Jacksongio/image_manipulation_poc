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

    const [image, mask] = await Promise.all([
      ctx.storage.get(args.imageId),
      ctx.storage.get(args.maskId),
    ])
    if (image === null || mask === null) throw new Error('The source image or selection mask is missing')

    const instruction = args.instruction.trim()
    const prompt =
      args.operation === 'remove'
        ? `Remove the object inside the transparent masked area and reconstruct the background naturally. Preserve everything outside the mask exactly. ${instruction}`
        : args.operation === 'retouch'
          ? `Retouch only the transparent masked area. Preserve the subject's identity and everything outside the mask exactly. ${instruction}`
          : `Replace only the transparent masked area as follows: ${instruction}. Preserve everything outside the mask exactly.`

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    const result = await openai.images.edit({
      model: 'gpt-image-2',
      image: await toFile(image, 'source.png', { type: 'image/png' }),
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
