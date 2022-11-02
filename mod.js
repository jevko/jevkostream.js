export const CodePoint = {
  _opener_: '['.codePointAt(0),
  _closer_: ']'.codePointAt(0),
  _escaper_: '`'.codePointAt(0),
  _newline_: `\n`.codePointAt(0),
}
const {
  _opener_: _opener_, _closer_: _closer_, _escaper_: _escaper_, _newline_: _newline_,
} = CodePoint

export const parseJevkoStream = (next, {
  maxDepth = 65536,
  opener = _opener_,
  closer = _closer_,
  escaper = _escaper_,
} = {}) => {
  let isEscaped = false
  let parents = []

  let line = 1, column = 1

  let ret

  const self = {
    codePoint: (code) => {
      if (isEscaped) {
        switch (code) {
          case escaper:
          case opener:
          case closer: {
            isEscaped = false
            ret = next.character?.(code)
            break
          }
          default:
            throw SyntaxError(`Invalid digraph (${String.fromCodePoint(escaper, code)}) at ${line}:${column}!`)
        }
      } else switch (code) {
        case escaper: {
          isEscaped = true
          ret = next.escaper?.(code)
          break
        }
        case opener: {
          if (parents.length >= maxDepth) throw Error(`Invalid parser state! Max depth of ${maxDepth} exceeded!`)
          parents.push([line, column])
          ret = next.opener?.(code)
          break
        }
        case closer: {
          if (parents.length === 0) throw SyntaxError(`Unexpected closer (${String.fromCodePoint(closer)}) at ${line}:${column}!`)

          parents.pop()
          ret = next.closer?.(code)
          break
        }
        default:
          ret = next.character?.(code)
          break
      }

      if (code === _newline_) {
        ++line
        column = 1
      } else {
        ++column
      } 
      return ret
    },
    end: () => {
      if (isEscaped) throw SyntaxError(`Unexpected end after escaper (${String.fromCodePoint(escaper)})!`)
      if (parents.length !== 0) {
        const [ln, col] = parents.pop()
        // todo: say which ln, col unclosed
        throw SyntaxError(`Unexpected end: missing ${parents.length} closer(s) (${String.fromCodePoint(closer)})!`)
      }

      return next.end?.()
    },
  }
  return self
}

export const parseJevkoStream2 = (next) => {
  let textBuffer = ''

  const self = {
    // escaper: (code) => {},
    opener: (code) => {
      let ret = next.prefix(textBuffer)
      textBuffer = ''
      return ret
    },
    closer: (code) => {
      let ret = next.suffix(textBuffer)
      textBuffer = ''
      return ret
    },
    character: (code) => {
      textBuffer += String.fromCharCode(code)
    },
    end: () => {
      next.suffix(textBuffer)
      textBuffer = ''
      return next.end?.()
    },
  }
  return self
}

export const parseJevkoStream3 = (next) => {
  const parents = []
  let parent = {subjevkos: []}

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
    end: () => {
      return next.end?.(parent)
    },
  }
  return self
}