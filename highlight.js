import {parseJevkoStream} from './mod.js'

const enc = new TextEncoder()

const brightGreen = [...enc.encode("[92m")]
const brightMagenta = [...enc.encode("[95m")]
const brightCyan = [...enc.encode("[96m")]
const green = [...enc.encode("[32m")]
const yellow = [...enc.encode("[33m")]
const cyan = [...enc.encode("[36m")]
const reset = [...enc.encode("[39m")]

let writeBuffer = []
const maxWriteBufferLen = 100
const write = {
  bytes(bytes) {
    writeBuffer.push(...bytes)
    if (writeBuffer.length > maxWriteBufferLen) {
      Deno.stdout.writeSync(new Uint8Array(writeBuffer))
      writeBuffer = []
    }
  },
  end() {
    if (writeBuffer.length > 0) {
      Deno.stdout.writeSync(new Uint8Array(writeBuffer))
    }
  }
}

const writeText = (text, info, color) => {
  let h = 0
  write.bytes(color)
  const {escapedAt} = info
  for (const i of escapedAt) {
    write.bytes(enc.encode(text.slice(h, i)))
    write.bytes(cyan)
    h = i + 1
    write.bytes(escaper)
    write.bytes(enc.encode(text[i]))
    write.bytes(color)
  }
  if (h < text.length) write.bytes(enc.encode(text.slice(h)))
  write.bytes(reset)
}


const escaper = [...enc.encode("`")]
const opener = [...enc.encode("[")]
const closer = [...enc.encode("]")]

const stream = parseJevkoStream(({
  prefix: (text, info) => {
    writeText(text, info, green)
    write.bytes(opener)
  },
  suffix: (text, info) => {
    writeText(text, info, yellow)
    write.bytes(closer)
  },
  end: (text, info) => {
    writeText(text, info, yellow)
    write.end()
  }
}))

stream.chunk(`first \`[name\`]\`\` [John]
last name [Smith]
is alive [true]
age [27]
address [
  street address [21 2nd Street]
  city [New York]
  state [NY]
  postal code [10021-3100]
]
phone numbers [
  [
    type [home]
    number [212 555-1234]
  ]
  [
    type [office]
    number [646 555-4567]
  ]
]
children []
spouse []
`)

stream.end()

