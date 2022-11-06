const newline = '\n'

export const parseJevkoStream = (next, {
  maxDepth = 65536,
  opener = "[",
  closer = "]",
  escaper = "`",
} = {}) => {
  let isEscaped = false
  let parents = []

  let line = 1, column = 1

  let h = 0

  let textBuffer = ''

  const self = {
    chunk: (chunk) => {
      for (let i = 0; i < chunk.length; ++i) {
        const code = chunk[i]
        if (isEscaped) {
          switch (code) {
            case escaper:
            case opener:
            case closer: {
              isEscaped = false
              break
            }
            default:
              throw SyntaxError(`Invalid digraph (${escaper + code}) at ${line}:${column}!`)
          }
        } else switch (code) {
          case escaper: {
            isEscaped = true
            textBuffer += chunk.slice(h, i)
            h = i + 1
            break
          }
          case opener: {
            if (parents.length >= maxDepth) throw Error(`Invalid parser state! Max depth of ${maxDepth} exceeded!`)

            parents.push([line, column])
            next.prefix?.(textBuffer + chunk.slice(h, i))
            textBuffer = ''
            h = i + 1
            break
          }
          case closer: {
            if (parents.length === 0) throw SyntaxError(`Unexpected closer (${closer}) at ${line}:${column}!`)
  
            parents.pop()
            next.suffix?.(textBuffer + chunk.slice(h, i))
            textBuffer = ''
            h = i + 1
            break
          }
          default: break
        }
  
        if (code === newline) {
          ++line
          column = 1
        } else {
          ++column
        }
      }
      textBuffer += chunk.slice(h)

      // todo:
      return 'ok'
    },
    end: () => {
      if (isEscaped) throw SyntaxError(`Unexpected end after escaper (${escaper})!`)
      if (parents.length !== 0) {
        const [ln, col] = parents.pop()
        // todo: say which ln, col unclosed
        throw SyntaxError(`Unexpected end: missing ${parents.length} closer(s) (${closer})!`)
      }

      const ret = next.end?.(textBuffer)
      textBuffer = ''
      return ret
    },
    state: () => {
      return {
        opener,
        closer,
        escaper,
      }
    },
  }
  return self
}

export const trimPrefixes = (next) => {
  const self = {
    ...next,
    prefix: (text) => {
      return next.prefix?.(text.trim())
    },
  }
  return self
}

export const jevkoStreamToTree = (next) => {
  let parent = {subjevkos: []}
  const parents = []

  const self = {
    prefix: (prefix) => {
      const jevko = {subjevkos: []}
      parent.subjevkos.push({prefix, jevko})
      parents.push(parent)
      parent = jevko
    },
    suffix: (suffix) => {
      parent.suffix = suffix
      parent = parents.pop()
    },
    end: (suffix) => {
      parent.suffix = suffix
      return next.end?.(parent)
    },
  }
  return self
}