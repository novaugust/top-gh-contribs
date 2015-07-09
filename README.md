top-gh-contribs
===============

A simple tool for grabbing the top contributors for a repo from github, with some convenient options.

Usage
----------------------

```
npm install top-gh-contribs
```

Returns a promise for an array of contributors with the following attributes

* `name` *The contributor's github username*
* `githubUrl` *The contributors github profile url*
* `avatarUrl` *The contributor's github avatar image url*
* `commitCount` *The number of commits the contributor has since the specified release*

```js
var topGithubContributors = require('top-gh-contribs');

var options = {
    user: 'tryghost',
    repo: 'ghost',
    sinceDate: '2015-02-01' // All commits since 1st February 2015
    count: 20
};

topGithubContributors(options).then(function (contributors) {
    /* Do stuff with contributors*/
});
```

### Options

* `user` **required**
* `repo` **required**
    If you're looking for contributors to `tryghost/ghost`, then your `user` is `"tryghost"` and `repo` is `"ghost"`.
* `oauthKey` ::
    If a GitHub oauth key is provided it will be used when making requests against the API.
* `sinceDate` ::
    A date, in ISO8601 format e.g 'YYYY-MM-DDTHH:MM:SSZ' or 'YYYY-MM-DD' format e.g. '2015-02-01' = 1st February 2015
    If `sinceDate` is not provided, all commits will be counted.
    Note: you can install moment.js and then use:
    var moment = require('moment');
    sinceDate: moment().subtract(90, 'days').format('YYYY-MM-DDTHH:MM:SSZ') to get a formatted date including time
    for past 90 days
* `count`
    The number of contributors to return. If not specified, all contributors will be returned.
* `retry`
    Default `false`.  If `true`, the request will be retried in the event GitHub returns a status of 202
    (retry momentarily).
