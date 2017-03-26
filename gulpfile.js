var gulp = require('gulp');
var handlebars = require('gulp-handlebars');
var declare = require('gulp-declare');
var wrap = require('gulp-wrap');
var concat = require('gulp-concat');
var concatCss = require('gulp-concat-css');
var uglify = require('gulp-uglify');
var change = require('gulp-change');
var cssmin = require('gulp-cssmin');
var watch = require('gulp-watch');
var htmlclean = require('gulp-htmlclean');
var clean = require('gulp-clean');
var rename = require('gulp-rename');
//var stripcomments = require('gulp-strip-comments');
//var stripcomments = require('remove-html-comments');

gulp.task('edit', ['html'], function () {
    watch([
        './build/**/*'
    ], 
    function (events, done) {
        gulp.start('html');
    });
});

gulp.task('clean', function () {
    return gulp
    .src('./public', {read: false})
    .pipe(clean());
});

gulp.task('html',['clean'],function(){
	return gulp
	.src([
	  './build/**/*'
	])
	.pipe(gulp.dest('./public'));
})

gulp.task('jsmin', ['html','clean'], function() {
	return gulp
	.src('./public/**/*.js')
    .pipe(uglify())
    .pipe(gulp.dest('./public'));
});

gulp.task('snapmin', function() {
    return gulp
    .src('./build/js/Snap.js')
    .pipe(uglify())
    .pipe(rename('Snap.min.js'))
    .pipe(gulp.dest('./public/js/'));
});

gulp.task('default',['snapmin','html','jsmin','clean'],function(){
	return gulp;
});
