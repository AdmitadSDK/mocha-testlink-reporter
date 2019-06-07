## Mocha TestLink reporter

Reports test execution statuses to TestLink. Uses either an existing test plan or creates a new one if required.

## Installation

```shell
$ npm install mocha-testlink-reporter
```
## Command line usage

If there is an existing test plan in TestRail that needs to be updated, then use the following command

```shell
$ mocha --reporter mocha-testlink-reporter --reporter-options URL=http://localhost,apiKey=1234567890,testplanid=7,buildid=2
```

Otherwise, just specify the test project prefix

```shell
$ mocha --reporter mocha-testlink-reporter --reporter-options URL=http://localhost,apiKey=1234567890,prefix=XPJ
```

## Mapping the mocha tests to TestLink counterparts
Mark the mocha test or suite descriptions with ID(s) of Testrail test cases in brackets.
If a mocha suite is labelled with a case ID, the test steps in TestLink will get updated with the status of tests in the mocha suite.
A deeper hierarchy is not reporterd, i.e. the status of tests in sub-suites, and sub-suites themselves, are not reported. 
 
```Javascript
it('[XPJ-1] a test case', ...

describe('[XPJ-2] a test case with steps', ...
  it('step 1', ...
  it('step N', ...
```

## Current limitations

- platforms are not supported yet
- only passed and failed test statuses are being reported. Skipped and pending ones are not.

## License

MIT License

Copyright (c) 2019 Admitad GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
