import { parseJevkoStream, jevkoStreamToTree, trimPrefixes } from "./mod.js"

Deno.test('stream', () => {
  const stream = parseJevkoStream(jevkoStreamToTree({
    end: (j) => {
      return JSON.stringify(j, null, 2)
    }
  }))

  stream.chunk(`first name [John]
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
  spouse []`)
  const x = stream.end()

  console.log(x)
})

Deno.test('trim prefixes', () => {
  // todo
  const stream = parseJevkoStream(
    trimPrefixes({
      prefix: (text) => {
        console.log('pre', `|${text}|`)
      },
      suffix: (text) => {
        // console.log('suf', `|${text}|`)
      },
      end: (text) => {
        // console.log('suf', `|${text}|`)
      },
    })
  )

  stream.chunk(`first name [John]
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
  spouse []`)
  const x = stream.end()
})