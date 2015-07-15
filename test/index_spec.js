/*jshint expr:true */
var expect = require('chai').expect;
var nock = require('nock');
var rewire = require('rewire');

var topContribs = rewire('../index.js');

nock.disableNetConnect();

describe('top-gh-contribs', function () {
    it('retry delay should be an exponential backoff in milliseconds', function () {
        var retryDelay = topContribs.__get__('retryDelay');

        expect(retryDelay(0)).to.be.above(1000).and.below(2000);
        expect(retryDelay(1)).to.be.above(2000).and.below(3000);
        expect(retryDelay(2)).to.be.above(4000).and.below(5000);
        expect(retryDelay(3)).to.be.above(8000).and.below(9000);
        expect(retryDelay(4)).to.be.above(16000).and.below(17000);
    });

    describe('getTopContributors', function () {
            var fixture = require(__dirname + '/fixtures/commits.json');

        it('should return all contributors if count is not provided not including authors with missing details', function () {
            var result = topContribs.getTopContributors(fixture);
            expect(result.length).to.equal(4);
        });

        it('should return no more than 3 contributors if count provided is 3', function () {
            var result = topContribs.getTopContributors(fixture, 3);
            expect(result.length).to.be.below(4);
        });

        it('should return the correct commit details not including merge commits', function () {
            var result = topContribs.getTopContributors(fixture);
            expect(result[0].commitCount).to.equal(3);
            expect(result[0].oldestCommit).to.equal('2015-06-22T20:11:35Z');
            expect(result[0].name).to.equal('ErisDS');
            expect(result[0].avatarUrl).to.equal('https://avatars.githubusercontent.com/u/101513?v=3');
            expect(result[0].githubUrl).to.equal('https://github.com/ErisDS');
        });

        it('should return contributors in correct order', function () {
            var result = topContribs.getTopContributors(fixture);
            expect(result[0].name).to.equal('ErisDS');
            expect(result[1].name).to.equal('halfdan');
            expect(result[2].name).to.equal('acburdine');
            expect(result[3].name).to.equal('JohnONolan');
        });
    });

    describe('requestPromise', function () {
        var requestPromise = topContribs.__get__('requestPromise');

        afterEach(function () {
            nock.cleanAll();
        });

        it('should reject on a status code of >= 500', function (done) {
            nock('http://example.com')
                .get('/')
                .reply(500);

            requestPromise({url: 'http://example.com/'}).then(function () {
                done(new Error('expected requestPromise to reject but it did not'));
            }).catch(function (err) {
                expect(err).to.be.instanceof(Error);

                done();
            });
        });

        it('should reject on a status code of >= 400', function (done) {
            nock('http://example.com')
                .get('/')
                .reply(404);

            requestPromise({url: 'http://example.com/'}).then(function () {
                done(new Error('expected requestPromise to reject but it did not'));
            }).catch(function (err) {
                expect(err).to.be.an.instanceof(Error);

                done();
            });
        });

        it('should return the response body on a status code of 200', function (done) {
            nock('http://example.com')
                .get('/')
                .reply(200, {some: 'thing'});

            requestPromise({url: 'http://example.com/'}).then(function (response) {
                expect(response).to.exist;
                expect(response[0].some).to.exist;
                expect(response[0].some).to.equal('thing');

                done();
            }).catch(done);
        });

        it('should return the response body and pagination url if available on a status code of 200', function (done) {
            nock('http://example.com')
                .get('/')
                .reply(200, {some: 'thing'}, {
                    link: '<https://api.github.com/repositories/8231436/commits?since=2015-05-08>; rel="next"'
                });

            requestPromise({url: 'http://example.com/'}).then(function (response) {
                expect(response).to.exist;
                expect(response[0].some).to.exist;
                expect(response[0].some).to.equal('thing');
                expect(response[1]).to.equal('https://api.github.com/repositories/8231436/commits?since=2015-05-08');

                done();
            }).catch(done);
        });

        it('should reject if status code is 202 and retry is not enabled', function (done) {
            nock('http://example.com')
                .get('/')
                .reply(202);

            requestPromise({url: 'http://example.com/'}).then(function () {
                done(new Error('expected requestPromise to reject but it did not'));
            }).catch(function (err) {
                expect(err).to.be.an.instanceof(Error);

                done();
            });
        });

        it('should retry if status code is 202 and retry is enabled', function (done) {
            this.timeout(5000);

            nock('http://example.com')
                .get('/')
                .reply(202)
                .get('/')
                .reply(200, {r: 'retry worked'});

            requestPromise({url: 'http://example.com/', retry: true}).then(function (response) {
                expect(response).to.exist;
                expect(response[0].r).to.exist;
                expect(response[0].r).to.equal('retry worked');

                done();
            }).catch(done);
        });
    });
});
