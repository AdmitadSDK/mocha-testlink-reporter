'use strict'

describe('[XPJ-2] good stuff', function () {
  it('goes to hell', function () {

  })

  it('invoke the devil', function () {
    throw Error('there be dragons here')
  })

  it('ignore me', function () {
    this.skip()
  })

  it('but he may cry', async function () {

  })
})

describe.skip('[XPJ-13] ignore me', function () {
  it('there is nothing to look at', function () {

  })
})

describe('here comes santa', function () {
  it('[XPJ-1] this test will time out', async function () {
    await new Promise(resolve => setTimeout(resolve, 3000))
  })

  it('[XPJ-3] stranger in a strange land', function () {

  })
})
