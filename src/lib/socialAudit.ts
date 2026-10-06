type SocialEvent =
  | 'request_created'
  | 'request_accepted'
  | 'request_declined'
  | 'request_cancelled'
  | 'friend_removed'
  | 'request_rate_limited'
  | 'request_conflict'

export function socialAudit(event: SocialEvent, actorId: string, subjectId: string) {
  void event
  void actorId
  void subjectId
}
