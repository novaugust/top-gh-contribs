var _ = require('lodash');
var request = require('request');
var Promise = require('bluebird');

var commits = [];

function main(options) {
    options = options || {};
    var user = options.user,
        repo = options.repo,
        oauthKey = options.oauth,
        queryParams = '?page=1&per_page=100',
        count = options.count || Infinity;

    queryParams += options.sinceDate ? '&since=' + options.sinceDate : '';

    if (!(user && repo)) {
        throw new Error('Must specify both github user and repo.');
    }

    var repoApiUrl = ['https://api.github.com/repos/', user, '/', repo, '/commits'].join(''),
        pagination = getPagination({
        url: repoApiUrl + queryParams,
        userAgent: user,
        oauthKey: oauthKey,
        retry: options.retry
    });

    return Promise.join(pagination, count, getTopContributors);
}

// This will load the first page of results for the /commits query then run queries to fetch paginated results
function getPagination(options) {
    options = options || {};
    var commitsPromise = requestPromise(options);

    return new Promise(function (resolve) {
        commitsPromise.then(function (results) {
            commits.push.apply(commits, results[0]);
            if (results[1]) {
                options.url = results[1];
                return resolve(getPagination(options));
            } else {
                return resolve(commits);
            }
        });
    });
}

function getTopContributors(commits, count) {
    // Filter out Merge commits
    commits =  _(commits).filter(function (c) {
        return c.commit.message.substring(0,18) !== 'Merge pull request';
    })
    // Merge author and commit details
    .map(function(c) {
        var commit = c.commit;
            if (c.author) {
                commit.author.avatar_url = c.author.avatar_url ? c.author.avatar_url : '';
                commit.author.html_url = c.author.html_url ? c.author.html_url : '';
                commit.author_name = c.author.login;
            }
        return commit;
    })
    // Create array with single entry per contributor
    .reduce(function(contributors, commit){
        var index = _.findIndex(contributors, {name: commit.author_name});
        if (index > -1) {
            contributors[index].commitCount += 1;
            if (commit.author.date < contributors[index].oldestCommit) {
                contributors[index].oldestCommit = commit.author.date;
            }
        } else {
            contributors.push({
                name: commit.author_name,
                commitCount: 1,
                oldestCommit: commit.author.date,
                avatarUrl: commit.author.avatar_url ? commit.author.avatar_url : '',
                githubUrl: commit.author.html_url ? commit.author.html_url : ''
            });
        }
        return contributors;
    }, []);
    // Cannot chain reduce...
    // Returns array of contributors ordered by highest commit count then sub-ordered by oldest commit
    // Size of the array is determined by the value of count
    return _.sortByOrder(commits, ['commitCount', 'oldestCommit'], ['desc', 'asc']).slice(0, count);
}

/*
 * @param {Object} options
 * @param {string} url - the url to request
 * @param {string} [userAgent]
 * @param {string} [oauthKey] - a GitHub oauth key with access to the repository being queried
 * @param {boolean} [retry] - retry on status code 202
 * @param {number} [retryCount]
 */
function requestPromise(options) {
    options = options || {};
    var headers = {'User-Agent': options.userAgent || 'request'};

    if (options.oauthKey) {
        headers.Authorization = 'token ' + options.oauthKey;
    }

    return new Promise(function (resolve, reject) {
        request({
            url: options.url,
            json: true,
            headers: headers
        }, function (error, response, body) {
            // Check response headers for pagination links
            var links = response.headers.link, nextPageUrl = '';

            if (links && _.includes(links, 'next')) {
                nextPageUrl = links.substring(1, links.indexOf('>; rel="next'));
            }

            if (error) {
                return reject(error);
            }

            function decorateError(error) {
                if (!error) {
                    throw new Error('error is required.');
                }

                error.url = options.url;
                error.http_status = response.statusCode;
                error.ratelimit_limit = response.headers['x-ratelimit-limit'];
                error.ratelimit_remaining = response.headers['x-ratelimit-remaining'];
                error.ratelimit_reset = parseInt(response.headers['x-ratelimit-reset'], 10);

                return error;
            }

            if (response.statusCode >= 500) {
                return reject(decorateError(new Error('Server error on url ' + options.url)));
            }
            if (response.statusCode >= 400) {
                return reject(decorateError(new Error('Client error on url ' + options.url)));
            }
            if (response.statusCode === 202) {
                if (!options.retry || options.retryCount > 4) {
                    return reject(decorateError(new Error('API returned status 202. Try again in a few moments.')));
                }

                var retryCount = parseInt(options.retryCount, 10) || 0;

                var retryPromise = Promise.delay(retryDelay(retryCount)).then(function () {
                    return requestPromise({
                        url: options.url,
                        userAgent: options.userAgent || 'request',
                        oauthKey: options.oauthKey,
                        retry: true,
                        retryCount: retryCount + 1
                    });
                });

                return resolve(retryPromise);
            }
            return resolve([body, nextPageUrl]);
        });
    });
}

function retryDelay(count) {
    return Math.floor((Math.pow(2, count) + Math.random()) * 1000);
}

main.getTopContributors = getTopContributors;

module.exports = main;
