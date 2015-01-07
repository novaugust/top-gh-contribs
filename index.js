var _ = require('lodash');
var request = require("request");
var Promise = require('bluebird');

function main(options) {
    var user = options.user;
    var repo = options.repo;
    var releaseDate = options.releaseDate;
    var releaseTag = options.releaseTag
    var count = options.count || Infinity;

    if (!(user && repo)) {
        throw new Error("Must specify both github user and repo.");
    }
    //Looks like we're good to go. Start making promises baby!
    var repoApiUrl = ['https://api.github.com/repos/', user, '/', repo].join('');

    var releaseDatePromise = getReleaseDatePromise(releaseDate, releaseTag, repoApiUrl, user);
    var contributorsPromise = requestPromise(repoApiUrl + '/stats/contributors', user);

    return Promise.join(releaseDatePromise, contributorsPromise, count, getTopContributors);
}

function getReleaseDatePromise (releaseDate, releaseTag, repoApiUrl, user) {
    if (releaseDate) {
        //Divide by 1k to remove milliseconds to match GH datestamps
        return Promise.resolve(releaseDate / 1000);
    }
    // If neither releaseDate or releaseTag were specified
    // sum all commits since the beginning of time.
    if (!releaseTag) {
        return resolve(0); // All time!
    }

    return requestPromise(repoApiUrl + '/releases', user).then(function (releases) {
        var lastRelease = _.find(releases, function findLastRelease(release) {
            return release.tag_name === releaseTag;
        });

        if (!lastRelease) {
            return Promise.reject(releaseTag + ' not found in github releases\'s tags.');
        }
        //Divide by 1k to remove milliseconds to match GH datestamps
        return lastReleaseDate = Date.parse(lastRelease.published_at) / 1000;
    });
}

function getTopContributors(releaseDate, contributors, count) {
    contributors =  _.map(contributors, function (contributor) {
        var numCommitsSinceReleaseDate = _.reduce(contributor.weeks,
            function (commits, week) {
                if (week.w >= releaseDate) {
                    commits += week.c;
                }
                return commits;
            }, 0);

        return {
            commitCount: numCommitsSinceReleaseDate,
            name: contributor.author.login,
            githubUrl: contributor.author.html_url,
            avatarUrl: contributor.author.avatar_url
        };
    });
    //Get the top `count` contributors by commits
    return _.chain(contributors).filter(function (c) {
        return c.commitCount > 0;
    }).sortBy('commitCount')
      .reverse()
      .slice(0, count)
      .value();
}

function requestPromise (url, agent) {
    return new Promise(function (resolve, reject) {
        request({
            url: url,
            json: true,
            headers: {
                'User-Agent': agent
            }
        }, function (error, response, body) {
            if (error) {
                return reject(error);
            }

            function decorateError(error) {
                if (!error) {
                    throw new Error('error is required.');
                }

                error.url = url;
                error.http_status = response.statusCode;
                error.ratelimit_limit = response.headers['x-ratelimit-limit'];
                error.ratelimit_remaining = response.headers['x-ratelimit-remaining'];
                error.ratelimit_reset = parseInt(response.headers['x-ratelimit-reset'], 10);

                return error;
            }

            if (response.statusCode >= 500) {
                return reject(decorateError(new Error('Server error on url ' + url)));
            }
            if (response.statusCode >= 400) {
                return reject(decorateError(new Error('Client error on url ' + url)));
            }
            return resolve(body);
        });
    });
}
main.getReleaseDatePromise = getReleaseDatePromise;
main.getTopContributors = getTopContributors;

module.exports = main;
