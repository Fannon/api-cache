[![npm version](https://img.shields.io/npm/v/cacheur.svg?style=flat)](https://www.npmjs.com/package/cacheur)
[![Dependency Status](https://img.shields.io/david/Fannon/cacheur.svg?style=flat)](https://david-dm.org/Fannon/cacheur)
[![Build Status](https://img.shields.io/travis/Fannon/cacheur.svg?style=flat)](http://travis-ci.org/Fannon/cacheur)
[![Code Climate](https://codeclimate.com/github/Fannon/cacheur/badges/gpa.svg)](https://codeclimate.com/github/Fannon/cacheur)
[![Test Coverage](https://codeclimate.com/github/Fannon/cacheur/badges/coverage.svg)](https://codeclimate.com/github/Fannon/cacheur)

## About
cacheur is a Node.js CLI tool for caching and transforming API results. It is built with modularity and simplicity in mind.

## Install

### Install globally
```bash
$ npm install -g cacheur
```

## Usage
### Run cacheur
```bash
# Within the project dir cacheur can be called directly:
cacheur

# It is possible to manually set the project directory:
cacheur --dir "/C/Dropbox/Software Projekte/cbmodel/caches/"
```

### Set up project
cacheur excepts a project directory that contains config files, containing the specific job settings and a project wide global setting file.


### Example Jobs
See: [/examples](/examples)

#### Cache an generic JSON API
```yaml
http:
  url: https://api.github.com/repos/jquery/jquery/issues
  queryString:
    state: open
```
This will make a http request to the GitHub API at given url and cache the result. The optional queryString object may contain URL parameters. In this case ?state=open will be appended to the url. The cache will be updated every 10 seconds. 

#### Fetch a CSV file 
```yaml
cacheExpiration: 360
timeout: 180
retryDelay: 30

http:
  url: https://data.cityofnewyork.us/api/views/5b3a-rs48/rows.csv?accessType=DOWNLOAD
```
This fetches a bigger CSV file from, renews the cache every 360 seconds. It will wait 180 seconds before timeout (this might however be shortened by your network settings). If the request fails, cacheur will retry after 30 seconds.

#### Cache an SemanticMediaWiki ASK Query

## Run cacheur as a linux service


## License

MIT © [Simon Heimler](http://www.fannon.de)

[npm-image]: https://badge.fury.io/js/cacheur.svg
[npm-url]: https://npmjs.org/package/cacheur
[travis-image]: https://travis-ci.org/Fannon/cacheur.svg?branch=master
[travis-url]: https://travis-ci.org/Fannon/cacheur
[daviddm-image]: https://david-dm.org/Fannon/cacheur.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/Fannon/cacheur
