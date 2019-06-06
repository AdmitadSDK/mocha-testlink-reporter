'use strict'
const TestLink = require('testlink-xmlrpc')
const { ExecutionStatus } = require('testlink-xmlrpc/lib/constants')

const mocha = require('mocha')
const {
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_SUITE_END
} = mocha.Runner.constants

// this reporter outputs test results, indenting two spaces per suite
class TestLinkReporter extends mocha.reporters.Spec {
  constructor (runner, options) {
    super(runner, options)

    const testlink = new TestLink({
      host: 'localhost',
      port: 80, // Set if you are not using default port
      secure: false, // Use https, if you are using http, set to false.
      apiKey: '6bfa04dbfbc5463925786ef48d1793d4' // The API KEY from TestLink. Get it from user profile.
    })

    this.testplanid = 14
    this.buildid = 1

    let promiseChain = testlink.checkDevKey().catch(console.error)

    runner
      .on(EVENT_SUITE_END, suite => {
        if (suite.title.length > 0) {
          const options = {
            testcaseexternalid: 'XPJ-2',
            testplanid: 14,
            status: suite.tests.some(t => t.state === 'failed') ? ExecutionStatus.FAILED : ExecutionStatus.PASSED,
            buildid: 1,
            execduration: suite.tests.reduce((acc, t) => acc + t.duration, 0) / 60000,
            steps: []
          }
          promiseChain = promiseChain.then(() => testlink.reportTCResult(options)).catch(console.error)
        }
      })
      .on(EVENT_TEST_PASS, test => {
        if (test.title.length > 0) {
          const options = this.tcOptions('XPJ-1', test.duration)
          promiseChain = promiseChain.then(() => testlink.reportTCResult(options)).catch(console.error)
        }
      })
      .on(EVENT_TEST_FAIL, (test, err) => {
        if (test.title.length > 0) {
          const options = this.tcOptions('XPJ-2', test.duration, err)
          promiseChain = promiseChain.then(() => testlink.reportTCResult(options)).catch(console.error)
        }
      })
  }

  /**
   * Call this function only within EVENT_TEST_PASS and EVENT_TEST_FAIL handlers
   * @param {string} testcaseexternalid e.g. XPJ-112
   * @param {int} duration test.duration
   * @param {Error} err object
   */
  tcOptions (testcaseexternalid, duration, err) {
    const status = err ? ExecutionStatus.FAILED : ExecutionStatus.PASSED
    const notes = err ? err.stack : ''

    return {
      testcaseexternalid,
      testplanid: this.testplanid,
      status,
      buildid: this.buildid,
      execduration: duration / 60000,
      notes,
      steps: []
    }
  }
}

module.exports = TestLinkReporter
