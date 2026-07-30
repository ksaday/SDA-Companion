import { db } from '@/lib/db'
import { AssistantClient } from '@/components/assistant/AssistantClient'

export const dynamic = 'force-dynamic'

export default async function AssistantPage() {
  const unverifiedSources = await db.source.count({
    where: { status: 'active', verified: false },
  })

  return <AssistantClient corpusIsSample={unverifiedSources > 0} />
}
