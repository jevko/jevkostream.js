const newline = '\n'

export const parseJevkoStream = (next, {
  maxDepth = 65536,
  // todo:
  maxTextBufferLength = 65536,
  opener = "[",
  closer = "]",
  escaper = "`",
} = {}) => {
  let isEscaped = false

  let line = 1, column = 1, index = 0

  let parents = [
    {
      from: {line, column, index}, 
      trivial: true,
      top: true,
      opener,
      closer,
      escaper,
    }
  ]

  let textBuffer = ''
  let escapedAt = []

  const self = {
    chunk: (chunk) => {
      let h = 0
      for (
        let i = 0; 
        i < chunk.length; 
        ++i, ++index
      ) {
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
            escapedAt.push(textBuffer.length)
            h = i + 1
            break
          }
          case opener: {
            if (parents.length >= maxDepth) throw Error(`Invalid parser state! Max depth of ${maxDepth} exceeded!`)

            parents.at(-1).trivial = false
            parents.push({
              from: {line, column, index}, 
              trivial: true
            })
            next.prefix?.(textBuffer + chunk.slice(h, i), {
              escapedAt,
            })
            escapedAt = []
            textBuffer = ''
            h = i + 1
            break
          }
          case closer: {
            if (parents.length === 1) throw SyntaxError(`Unexpected closer (${closer}) at ${line}:${column}!`)
  
            const parentInfo = parents.pop()
            parentInfo.to = {line, column, index}
            next.suffix?.(textBuffer + chunk.slice(h, i), {
              parentInfo,
              escapedAt,
            })
            escapedAt = []
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
      if (parents.length !== 1) {
        const parentInfo = parents.pop()
        // todo: say which ln, col unclosed
        throw SyntaxError(`Unexpected end: missing ${parents.length} closer(s) (${closer})!`)
      }

      const ret = next.end?.(textBuffer, {
        parentInfo: parents[0],
        escapedAt,
      })
      escapedAt = []
      textBuffer = ''
      // todo: maybe reset all state or forbid calling chunk again; self.chunk = () => throw Error
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
    prefix: (text, info) => {
      return next.prefix?.(text.trim(), info)
    },
  }
  return self
}

export const removeByPrefix = (next, commentPrefix = '--') => {
  let isRemoved = false
  const self = {
    ...next,
    prefix: (text, info) => {
      if (isRemoved === false) {
        if (text === commentPrefix) isRemoved = true
        else return next.prefix?.(text, info)
      }
    },
    suffix: (text, info) => {
      if (isRemoved === false) {
        return next.suffix?.(text, info)
      } else {
        isRemoved = false
      }
    }
  }
  return self
}

export const jevkoStreamToTree = (next) => {
  let parent = {subjevkos: []}
  const parents = []

  const self = {
    prefix: (prefix, info) => {
      const jevko = {subjevkos: []}
      parent.subjevkos.push({prefix, jevko, info})
      parents.push(parent)
      parent = jevko
    },
    suffix: (suffix, info) => {
      parent.suffix = suffix
      parent.info = info
      parent = parents.pop()
    },
    end: (suffix, info) => {
      parent.suffix = suffix
      parent.info = info
      return next.end?.(parent)
    },
  }
  return self
}