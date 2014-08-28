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
    releaseTag: '0.4.2',
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
* `releaseTag` *optional*
    A release tag. If provided, top-gh-contribs will pull down your list of releases from github and look for the date of the matching release.
* `releaseDate` *not tested*
    The idea is, this will allow you to specify an arbitrary date. I haven't actually tested it yet, and unless someone says something, probably never will!

    If neither `releaseTag` nor `releaseDate` is provided, all commits in the last year will be counted.
* `count`
    The number of contributors to return. If not specified, all contributors will be returned.
