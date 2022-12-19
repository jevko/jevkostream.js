import { parseJevkoStream, jevkoStreamToTree, trimPrefixes, removeByPrefix } from "./mod.js"

import {assert, assertEquals} from './devDeps.js'

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


Deno.test('remove by prefix', () => {
  // todo
  const stream = parseJevkoStream(
    trimPrefixes(removeByPrefix({
      prefix: (text) => {
        console.log('pre', `|${text}|`)
      },
      suffix: (text) => {
        // console.log('suf', `|${text}|`)
      },
      end: (text) => {
        // console.log('suf', `|${text}|`)
      },
    }))
  )

  stream.chunk(`first name [John]
  last name [Smith]
  is alive [true]
  age [27]
  -- [
    street address [21 2nd Street]
    city [New York]
    state [NY]
    postal code [
      str [10021-3100]
      oops
    ]
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

Deno.test('heredoc', () => {
  // todo
  const stream = parseJevkoStream(
    trimPrefixes(removeByPrefix({
      prefix: (text) => {
        // console.log('pre', `|${text}|`)
      },
      suffix: (text, info) => {
        if (info.tag !== undefined) {
          assertEquals(text, `---
    street address [21 2nd Street]
    city [New York]
    state [NY]
    postal code [
      str [10021-3100]
      oops
    ]
---`)
        }
        // console.log('suf', `|${text}|`)
      },
      end: (text) => {
        // console.log('suf', `|${text}|`)
      },
    }))
  )

  stream.chunk(`first name [John]
  last name [Smith]
  is alive [true]
  age [27]
  heredoc \`/xyz/---
    street address [21 2nd Street]
    city [New York]
    state [NY]
    postal code [
      str [10021-3100]
      oops
    ]
---/xyz/
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

// todo: test heredoc on the edge of chunk