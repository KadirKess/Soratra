import postgres from 'postgres'

async function main() {
  const connectionString = process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error('POSTGRES_URL is required to audit friendship integrity.')
  }

  const client = postgres(connectionString, { max: 1 })
  try {
    const [usernameCollisions, reversePairs] = await Promise.all([
      client<{ count: string }[]>`
        select count(*)::text as count
        from (
          select lower(btrim(username))
          from users
          group by lower(btrim(username))
          having count(*) > 1
        ) collisions
      `,
      client<{ count: string }[]>`
        select count(*)::text as count
        from (
          select least(requester_id, addressee_id), greatest(requester_id, addressee_id)
          from friendships
          group by least(requester_id, addressee_id), greatest(requester_id, addressee_id)
          having count(*) > 1
        ) pairs
      `,
    ])
    const usernameCollisionCount = Number(usernameCollisions[0]?.count ?? 0)
    const reversePairCount = Number(reversePairs[0]?.count ?? 0)
    process.stdout.write(`username_case_collisions=${usernameCollisionCount}\nreverse_friendship_pairs=${reversePairCount}\n`)
    if (usernameCollisionCount > 0 || reversePairCount > 0) process.exitCode = 1
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Friendship integrity audit failed.'}\n`)
  process.exitCode = 1
})
