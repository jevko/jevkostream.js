const newline = '\n'

export const parseJevkoStream = (next, {
  maxDepth = 65536,
  // todo:
  maxTextBufferLength = 65536,
  opener = "[",
  closer = "]",
  escaper = "`",
  blocker = "/",
} = {}) => {
  let mode = 'normal'
  let tag = ''

  let line = 1, column = 1, index = 0

  let parents = [
    {
      from: {line, column, index}, 
      length: 0,
      top: true,
      opener,
      closer,
      escaper,
      blocker,
    }
  ]

  let textBuffer = ''
  let escapedAt = []

  // note: should be inlined for perf
  const open = (chunk, h, i) => {
    if (parents.length >= maxDepth) throw Error(`Invalid parser state! Max depth of ${maxDepth} exceeded!`)

    parents.at(-1).length += 1
    const parentInfo = {
      from: {line, column, index}, 
      length: 0,
    }
    parents.push(parentInfo)
    next.prefix?.(textBuffer + chunk.slice(h, i), {
      ...parentInfo,
      escapedAt,
    })
    escapedAt = []
    textBuffer = ''
  }

  // note: should be inlined for perf
  const close = (chunk, h, i, tag) => {
    if (parents.length === 1) throw SyntaxError(`Unexpected closer (${closer}) at ${line}:${column}!`)
  
    const parentInfo = parents.pop()
    parentInfo.to = {line, column, index}
    if (tag !== undefined) parentInfo.tag = tag
    next.suffix?.(textBuffer + chunk.slice(h, i), {
      ...parentInfo,
      escapedAt,
    })
    escapedAt = []
    textBuffer = ''
  }

  const self = {
    chunk: (chunk) => {
      let h = 0, t = 0
      for (
        let i = 0; 
        i < chunk.length; 
        ++i, ++index
      ) {
        const code = chunk[i]

        if (mode === 'escaped') {
          switch (code) {
            case escaper:
            case opener:
            case closer: {
              mode = 'normal'
              break
            }
            case blocker: {
              open(chunk, h, i)
              // h = i + 1

              mode = 'tag'
              t = i + 1
              break
            }
            default:
              throw SyntaxError(`Invalid digraph (${escaper + code}) at ${line}:${column}!`)
          }
        } else if (mode === 'tag') {
          if (code === blocker) {
            tag = textBuffer + chunk.slice(t, i)
            textBuffer = ''
            h = i + 1
            t = h
            mode = 'block'
          }
        } else if (mode === 'block') {
          if (code === blocker) {
            const found = textBuffer + chunk.slice(h, i)
            if (found === tag) {
              close(chunk, t, h - 1, tag)
              h = i + 1
              
              tag = ''
              mode = 'normal'
            } else {
              h = i + 1
            }
          }
        } else /* if (mode === 'normal') */ switch (code) {
          case escaper: {
            mode = 'escaped'
            textBuffer += chunk.slice(h, i)
            escapedAt.push(textBuffer.length)
            h = i + 1
            break
          }
          case opener: {
            open(chunk, h, i)
            h = i + 1
            break
          }
          case closer: {
            close(chunk, h, i)
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
      // todo: better error msgs
      if (mode === 'escaped') throw SyntaxError(`Unexpected end after escaper (${escaper})!`)
      if (mode === 'tag') throw SyntaxError(`Unexpected end after blocker (${blocker})!`)
      if (mode === 'block') throw SyntaxError(`Unexpected end after blocker (${blocker})!`)
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
  let depth = 0
  const self = {
    ...next,
    prefix: (text, info) => {
      if (isRemoved === false) {
        if (text === commentPrefix) isRemoved = true
        else return next.prefix?.(text, info)
      } else ++depth
    },
    suffix: (text, info) => {
      if (isRemoved === false) {
        return next.suffix?.(text, info)
      } else if (depth === 0) {
        isRemoved = false
      } else --depth
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
      // note: for compatibility w/ parseJevkoWithHeredocs parent.info.tag should become parent.tag
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