export type Section = 'home' | 'library' | 'journal' | 'friends' | 'profile' | 'admin'

// Each section owns a pastel (see [data-section] in globals.css). Pages without
// a nav item of their own borrow the colour of the place they belong to.
export function sectionFor(path: string): Section | null {
  if (path === '/') return 'home'
  const [first, second] = path.split('/').filter(Boolean)
  switch (first) {
    case 'library':
    case 'books':
    case 'search':
      return 'library'
    case 'journal':
      return 'journal'
    case 'friends':
      return 'friends'
    case 'admin':
      return 'admin'
    case 'profile':
      // /profile/<username> is a friend's page; password and delete are yours.
      return !second || second === 'password' || second === 'delete' ? 'profile' : 'friends'
    default:
      return null
  }
}
