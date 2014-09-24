var _ = require('lodash');
var request = require("request");
var Promise = require('bluebird');

function main(options) {
    var user = options.user;
    var repo = options.repo;
    var releaseDate = options.releaseDate;
    var fromReleaseTag = options.fromReleaseTag || options.releaseTag;
    var toReleaseTag  = options.toReleaseTag || 'master';
    var count = options.count || Infinity;

    if (!(user && repo)) {
        throw new Error("Must specify both github user and repo.");
    }
    //Looks like we're good to go. Start making promises baby!
    var repoApiUrl = ['https://api.github.com/repos/', user, '/', repo].join('');
    var compareUrl = [repoApiUrl, '/compare/', fromReleaseTag, '...', toReleaseTag].join('');

    //var releaseDatePromise = getReleaseDatePromise(releaseDate, toReleaseTag, repoApiUrl, user);
    //var contributorsPromise = requestPromise(repoApiUrl + '/stats/contributors', user);
    //return Promise.join(releaseDatePromise, contributorsPromise, count, getTopContributors);

    var commitsPromise = requestPromise(compareUrl, user);
    return Promise.join(commitsPromise, count, getTopContributorsFromCommits);
}

function getReleaseDatePromise (releaseDate, releaseTag, repoApiUrl, user) {
    if (releaseDate) {
        return Promise.resolve(releaseDate);
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


function getFirstLineOfMessage(message) {
    var firstNewLine = message.indexOf('\n');

    if (firstNewLine === -1) {
        return message;
    }

    if (firstNewLine !== 0) {
        return message.substr(0,  firstNewLine);
    }

    return message;
}

function getTopContributorsFromCommits(commits, count) {
    var contributors = {};
    commits = commits.commits;

    _.each(commits, function (commit) {
        // first line of message
        var message = getFirstLineOfMessage(commit.commit.message);

        // Exclude merges (this could be an option)
        if (message.indexOf('Merge') === 0) {
            return;
        }

        if (contributors.hasOwnProperty(commit.author.login)) {
            contributors[commit.author.login].commitCount += 1;
            contributors[commit.author.login].commits.push(message);
        } else {
            contributors[commit.author.login] = {
                commitCount: 1,
                name: commit.author.login,
                realName: commit.commit.author.name,
                githubUrl: commit.author.html_url,
                avatarUrl: commit.author.avatar_url,
                commits: [message]
            };
        }
    });

    return _.sortBy(contributors, 'commitCount').reverse().slice(0, count);
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
    return _.sortBy(contributors, 'commitCount').reverse().slice(0, count);
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
            if (response.statusCode >= 500) {
                return reject('Server error on url ' + url);
            }
            if (response.statusCode >= 400) {
                return reject('Client error on url ' + url);
            }
            return resolve(body);
        });
    });
}

module.exports = main;
