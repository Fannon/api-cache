'use strict';
module.exports = function(grunt) {
    
    // Show elapsed time at the end
    require('time-grunt')(grunt);
    // Load all grunt tasks
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: '.jshintrc',
                reporter: require('jshint-stylish'),
                force: true
            },
            gruntfile: {
                src: ['Gruntfile.js']
            },
            js: {
                src: ['cli.js', 'src/*.js']
            },
            test: {
                src: ['test/**/*.js']
            }
        },
        jscs: {
            options: {
                config: '.jscsrc',
                force: true
            },
            lib: {
                src: ['lib/**/*.js']
            },
            test: {
                src: ['test/**/*.js']
            }
        },
        mochacli: {
            options: {
                reporter: 'nyan',
                bail: true
            },
            all: ['test/*.js']
        },
        mocha_istanbul: {
            coverage: {
                src: ['test/'],
                options: {
                    mask: '*.spec.js',
                    coverage: true,
                    reportFormats: ['lcov', 'text']
                }
            }
        },
        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint:gruntfile']
            },
            js: {
                files: '<%= jshint.js.src %>',
                tasks: ['jshint:js', 'mochacli']
            },
            test: {
                files: '<%= jshint.test.src %>',
                tasks: ['jshint:test', 'mochacli']
            }
        }
    });

    grunt.registerTask('lint', ['jshint', 'jscs']);
    grunt.registerTask('coverage', ['mocha_istanbul:coverage']);
    grunt.registerTask('test', ['lint', 'coverage']);
    grunt.registerTask('default', ['test']);
    grunt.registerTask('watch', ['test', 'watch']);

    grunt.event.on('coverage', function(content, done) {
        done();
    });
};
