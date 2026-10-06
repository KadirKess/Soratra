export function titlesMatch(left: string, right: string) {
  return left.trim().normalize('NFKC').toLocaleLowerCase() === right.trim().normalize('NFKC').toLocaleLowerCase()
}
